"use client";

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useRouter as useNavigate } from 'next/navigation';

import { Search, Plus, MoreVertical, Camera, MessageSquare, X, RefreshCw, Upload, Users, MessageSquarePlus, ArrowLeft, Video, Paperclip } from 'lucide-react';

import { motion, AnimatePresence } from 'motion/react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { supabase, Group } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

const generateUUID = () => {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export default function Home() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupAvatar, setNewGroupAvatar] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSearchUsersOpen, setIsSearchUsersOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [foundUsers, setFoundUsers] = useState<any[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [viewingMedia, setViewingMedia] = useState<{ url: string, type: 'image' | 'video' | 'profile', id?: string } | null>(null);


  useEffect(() => {
    fetchGroups();

    // Set up Real-time subscription for messages
    const channel = supabase
      .channel('chat-list-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        async (payload) => {
          const user = await getCurrentUser();
          if (!user) return;

          if (payload.eventType === 'INSERT') {
            const newMessage = payload.new;
            
            // Fetch sender profile for the new message
            const { data: profile } = await supabase
              .from('profiles')
              .select('username')
              .eq('id', newMessage.sender_id)
              .single();

            setGroups(prev => {
              const groupIndex = prev.findIndex(g => g.id === newMessage.group_id);
              if (groupIndex === -1) return prev; 

              const updatedGroup = {
                ...prev[groupIndex],
                last_message: newMessage.content,
                last_message_time: newMessage.created_at,
                last_sender_name: newMessage.sender_id === user.id ? 'You' : (profile?.username || 'Unknown'),
                last_message_type: newMessage.type,
                unread_count: newMessage.sender_id !== user.id 
                  ? (prev[groupIndex].unread_count || 0) + 1 
                  : prev[groupIndex].unread_count
              };

              const otherGroups = prev.filter(g => g.id !== newMessage.group_id);
              return [updatedGroup, ...otherGroups]; // Move to top
            });

            // Mark as delivered globally if I am the recipient
            if (newMessage.sender_id !== user.id) {
              const currentDeliveredTo = Array.isArray(newMessage.delivered_to) ? newMessage.delivered_to : [];
              if (!currentDeliveredTo.includes(user.id)) {
                await supabase
                  .from('messages')
                  .update({ delivered_to: Array.from(new Set([...currentDeliveredTo, user.id])) })
                  .eq('id', newMessage.id);
              }
            }
          } else if (payload.eventType === 'UPDATE') {
            // Re-calculate unread count for the affected group if readStatus changed
            const updatedMsg = payload.new;
            fetchUnreadCountForGroup(updatedMsg.group_id, user.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchGroups() {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('*, group_members!inner(user_id)')
        .eq('group_members.user_id', user.id)
        .order('created_at', { ascending: false });

      if (groupsError) throw groupsError;

      // Fetch last message and unread count for each group
      const groupsWithData = await Promise.all((groupsData || []).map(async (group) => {
        const { data: lastMsgData } = await supabase
          .from('messages')
          .select('content, created_at, type, sender_id, profiles(username)')
          .eq('group_id', group.id)
          .or('is_deleted.eq.false,is_deleted.is.null') // Filter out deleted messages
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        const senderName = (lastMsgData as any)?.profiles?.username || 'Unknown';

        // Calculate unread count (messages where read_by Doesn't include user.id)
        const { count: unreadCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', group.id)
          .or('is_deleted.eq.false,is_deleted.is.null') // Filter out deleted messages
          .not('read_by', 'cs', `{"${user.id}"}`);

        // For DM chats, resolve the other user's info
        let dmInfo = { name: group.name, avatar: group.avatar_url };
        if (group.type === 'dm') {
          const { data: otherMember } = await supabase
            .from('group_members')
            .select('profiles(username, avatar_url)')
            .eq('group_id', group.id)
            .neq('user_id', user.id)
            .single();
          
          if (otherMember?.profiles) {
            dmInfo.name = (otherMember.profiles as any).username;
            dmInfo.avatar = (otherMember.profiles as any).avatar_url;
          }
        }

        return {
          ...group,
          display_name: dmInfo.name,
          display_avatar: dmInfo.avatar,
          last_message: lastMsgData?.content || null,
          last_message_time: lastMsgData?.created_at || group.created_at,
          last_sender_name: lastMsgData?.sender_id === user.id ? 'You' : senderName,
          last_message_type: lastMsgData?.type || 'text',
          unread_count: unreadCount || 0
        };
      }));

      setGroups(groupsWithData);

      // Background task: Mark all undelivered messages in these groups as delivered
      const groupIds = groupsData.map(g => g.id);
      if (groupIds.length > 0) {
        const { data: undelivered } = await supabase
          .from('messages')
          .select('id, delivered_to')
          .in('group_id', groupIds)
          .neq('sender_id', user.id)
          .not('delivered_to', 'cs', `{"${user.id}"}`);

        if (undelivered && undelivered.length > 0) {
          await Promise.all(undelivered.map(async (msg) => {
            const currentDeliveredTo = Array.isArray(msg.delivered_to) ? msg.delivered_to : [];
            await supabase
              .from('messages')
              .update({ delivered_to: Array.from(new Set([...currentDeliveredTo, user.id])) })
              .eq('id', msg.id);
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchUnreadCountForGroup(groupId: string, userId: string) {
    try {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId)
        .not('read_by', 'cs', `{"${userId}"}`);

      setGroups(prev => prev.map(g => 
        g.id === groupId ? { ...g, unread_count: count || 0 } : g
      ));
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `group-avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath);

      setNewGroupAvatar(publicUrl);
      toast.success('Group photo uploaded!');
    } catch (error: any) {
      toast.error('Failed to upload photo');
      console.error(error);
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    
    setIsCreating(true);
    try {
      const user = await getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      const { data: group, error: groupError } = await supabase
        .from('groups')
        .insert({
          name: newGroupName,
          description: newGroupDesc,
          avatar_url: newGroupAvatar,
          created_by: user.id
        })
        .select()
        .single();

      if (groupError) {
        if (localStorage.getItem('mock_session')) {
          // In Dev Mode, if DB fails, add a local mock group
          const mockGroup = {
            id: generateUUID(),
            name: newGroupName,
            description: newGroupDesc,
            created_by: user.id,
            created_at: new Date().toISOString(),
            last_message: null,
            last_message_time: new Date().toISOString()
          };
          setGroups(prev => [mockGroup as any, ...prev]);
          toast.success('Group created locally (Dev Mode)');
          setIsCreateDialogOpen(false);
          setNewGroupName('');
          setNewGroupDesc('');
          return;
        }
        throw groupError;
      }

      // Add creator as admin member
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: group.id,
          user_id: user.id,
          role: 'admin'
        });

      if (memberError) throw memberError;

      toast.success('Group created successfully!');
      setIsCreateDialogOpen(false);
      setNewGroupName('');
      setNewGroupDesc('');
      navigate.push(`/chat/${group.id}`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsCreating(false);
    }
  }

  async function searchUsers(query: string) {
    if (!query.trim()) {
      setFoundUsers([]);
      return;
    }
    
    setIsSearchingUsers(true);
    try {
      const user = await getCurrentUser();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', `%${query}%`)
        .neq('id', user?.id)
        .limit(10);
      
      if (error) throw error;
      setFoundUsers(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearchingUsers(false);
    }
  }

  async function handleStartDM(targetUserId: string) {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      // 1. Check if DM already exists
      const { data: existingDMs, error: dmError } = await supabase
        .from('groups')
        .select('*, group_members!inner(user_id)')
        .eq('type', 'dm')
        .eq('group_members.user_id', user.id);
      
      if (dmError) throw dmError;

      // Filter groups that also have the targetUserId
      // Note: This is a bit tricky with Supabase basic filters, might need a better query
      // but for now we'll find it manually or via a separate check
      let targetGroupId = null;

      for (const dm of (existingDMs || [])) {
        const { data: members } = await supabase
          .from('group_members')
          .select('user_id')
          .eq('group_id', dm.id);
        
        if (members?.some(m => m.user_id === targetUserId)) {
          targetGroupId = dm.id;
          break;
        }
      }

      if (targetGroupId) {
        navigate.push(`/chat/${targetGroupId}`);
      } else {
        // 2. Create new DM
        const { data: newGroup, error: createError } = await supabase
          .from('groups')
          .insert({
            name: `DM-${user.id}-${targetUserId}`, // Internal name, UI will resolve display name
            type: 'dm',
            created_by: user.id
          })
          .select()
          .single();
        
        if (createError) throw createError;

        // Add both users
        await supabase.from('group_members').insert([
          { group_id: newGroup.id, user_id: user.id, role: 'member' },
          { group_id: newGroup.id, user_id: targetUserId, role: 'member' }
        ]);

        navigate.push(`/chat/${newGroup.id}`);
      }
    } catch (err: any) {
      toast.error('Failed to start chat');
      console.error(err);
    }
  }

  const [isRefreshing, setIsRefreshing] = useState(false);


  async function handleRefresh() {
    if (isRefreshing) return;
    setIsRefreshing(true);
    await fetchGroups();
    setIsRefreshing(false);
    toast.success('Chats updated');
  }

  const filteredGroups = groups.filter(g => 
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-[100dvh] bg-white overflow-hidden">
      {/* Header */}
      <header className="px-4 py-4 flex items-center justify-between bg-white/80 backdrop-blur-md z-40 border-b border-slate-50 flex-shrink-0">
        <h1 className="text-2xl font-bold text-emerald-600 tracking-tight">WhatsApp Pro</h1>
        <div className="flex items-center gap-4 text-slate-600">
          <Camera size={22} className="cursor-pointer hover:text-emerald-600 transition-colors" />
          <MessageSquarePlus 
            size={22} 
            className="cursor-pointer hover:text-emerald-600 transition-colors" 
            onClick={() => setIsSearchUsersOpen(true)}
          />
          <MoreVertical size={22} className="cursor-pointer hover:text-emerald-600 transition-colors" />
        </div>

      </header>

      {/* Search Bar */}
      <div className="px-4 mb-4 flex-shrink-0">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
          <Input 
            placeholder="Search chats..." 
            className="pl-10 bg-slate-100 border-none rounded-2xl focus-visible:ring-2 focus-visible:ring-emerald-500/20 transition-all placeholder:text-slate-400 placeholder:font-normal"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Chat List with Drag to Refresh */}
      <div className="flex-1 overflow-y-auto touch-pan-y">
        <motion.div 
          className="px-2 pb-24 min-h-full"
        >
          <AnimatePresence mode="popLayout">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-3 animate-pulse">
                  <div className="w-14 h-14 bg-slate-200 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-1/3" />
                    <div className="h-3 bg-slate-200 rounded w-2/3" />
                  </div>
                </div>
              ))
            ) : filteredGroups.length > 0 ? (
              filteredGroups.map((group, index) => (
                <motion.div
                  key={group.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => navigate.push(`/chat/${group.id}`)}
                  className="flex items-center gap-4 p-3 bg-white hover:bg-slate-50 cursor-pointer transition-all active:scale-[0.98] rounded-2xl relative mb-1"
                >
                    <Avatar 
                      className="w-14 h-14 border-2 border-white shadow-sm cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                      onClick={(e) => {
                        e.stopPropagation();
                        const avatar = (group as any).display_avatar;
                        if (avatar) {
                          setViewingMedia({ url: avatar, type: 'profile', id: group.id });
                        }
                      }}
                    >
                      <AvatarImage src={(group as any).display_avatar} />
                      <AvatarFallback className="bg-emerald-100 text-emerald-700 font-bold text-lg">
                        {(group as any).display_name?.substring(0, 2).toUpperCase() || '??'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 border-b border-slate-100 pb-3 relative">
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="font-semibold text-slate-900 line-clamp-1">{(group as any).display_name}</h3>
                        <span className="text-xs text-slate-400 font-medium" suppressHydrationWarning>
                          {formatDistanceToNow(new Date((group as any).last_message_time || group.created_at), { addSuffix: false })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-sm text-slate-500 line-clamp-1 flex-1 pr-8">
                          {group.last_message ? (
                            <>
                              {group.last_sender_name && group.last_message_type !== 'system' && (
                                <span className="font-semibold text-slate-700">{group.last_sender_name}: </span>
                              )}
                              <span className="text-slate-600">
                                {group.last_message_type === 'image' ? '📷 Photo' : 
                                 group.last_message_type === 'video' ? '🎥 Video' :
                                 group.last_message_type === 'document' ? '📄 Document' : 
                                 group.last_message}
                              </span>
                            </>
                          ) : (
                            <span className="text-slate-400 italic font-normal">
                              {group.description || 'Tap to start chatting...'}
                            </span>
                          )}
                        </p>
                        {Number(group.unread_count) > 0 ? (
                          <div className="absolute right-0 bottom-4 bg-emerald-500 text-white text-[10px] font-bold min-w-[20px] h-[20px] rounded-full flex items-center justify-center px-1.5 shadow-sm animate-in zoom-in">
                            {(group.unread_count || 0) > 99 ? '99+' : group.unread_count}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </motion.div>
                ))
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <MessageSquare size={48} className="mb-4 opacity-20" />
                <p>No chats found</p>
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Create Group Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogTrigger
          render={
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="fixed bottom-24 right-6 w-14 h-14 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-200 flex items-center justify-center z-40"
            />
          }
        >
          <Plus size={28} />
        </DialogTrigger>
        <DialogContent className="border-none shadow-none">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">New Group</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateGroup} className="space-y-6">
            <div className="flex flex-col items-center gap-4 py-2">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-24 h-24 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 hover:border-emerald-300 transition-all relative overflow-hidden group"
              >
                {newGroupAvatar ? (
                  <img src={newGroupAvatar} className="w-full h-full object-cover" />
                ) : (
                  <>
                    <Camera className="text-slate-400 mb-1" size={24} />
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Add Photo</span>
                  </>
                )}
                {isUploadingAvatar && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                    <RefreshCw className="animate-spin text-emerald-500" size={20} />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Upload className="text-white" size={20} />
                </div>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleAvatarUpload}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] ml-1">Group Name</label>
              <Input
                placeholder="e.g. Design Team"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                required
                className="bg-slate-50 border border-slate-200/60 rounded-xl h-12 focus-visible:ring-emerald-500/20 placeholder:text-slate-400/70 placeholder:font-normal"
              />
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] ml-1">Description (Optional)</label>
                <Input
                  placeholder="What's this group about?"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  className="bg-slate-50 border border-slate-200/60 rounded-xl h-12 focus-visible:ring-emerald-500/20 placeholder:text-slate-400/70 placeholder:font-normal"
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="submit" 
                className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-100 transition-all active:scale-[0.98]"
                disabled={isCreating}
              >
                {isCreating ? 'Creating...' : 'Create Group'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* User Search Dialog */}
      <Dialog open={isSearchUsersOpen} onOpenChange={setIsSearchUsersOpen}>
        <DialogContent className="border-none shadow-none max-h-[80vh] flex flex-col p-0">
          <DialogHeader className="p-6 border-b border-slate-50">
            <DialogTitle>New Chat</DialogTitle>
            <DialogDescription>Search for people to start a conversation.</DialogDescription>
          </DialogHeader>
          
          <div className="p-4 flex-1 overflow-hidden flex flex-col">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <Input 
                placeholder="Search username..." 
                className="pl-9 bg-slate-50 border-none rounded-xl"
                value={userSearchQuery}
                onChange={(e) => {
                  setUserSearchQuery(e.target.value);
                  searchUsers(e.target.value);
                }}
              />
            </div>

            <ScrollArea className="flex-1">
              <div className="space-y-2">
                {isSearchingUsers ? (
                  <div className="flex justify-center p-8">
                    <RefreshCw className="animate-spin text-emerald-500" size={24} />
                  </div>
                ) : foundUsers.length > 0 ? (
                  foundUsers.map(u => (
                    <div 
                      key={u.id}
                      onClick={() => handleStartDM(u.id)}
                      className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-2xl cursor-pointer transition-colors border border-transparent hover:border-slate-100"
                    >
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={u.avatar_url} />
                        <AvatarFallback className="bg-emerald-100 text-emerald-700 font-bold">
                          {u.username.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">{u.username}</p>
                        <p className="text-xs text-slate-400 truncate">{u.status || 'Available'}</p>
                      </div>
                    </div>
                  ))
                ) : userSearchQuery ? (
                  <div className="text-center py-8 text-slate-400 text-sm">No users found</div>
                ) : (
                  <div className="text-center py-8 text-slate-400 text-sm flex flex-col items-center gap-2">
                    <Users size={32} className="opacity-20" />
                    <p>Enter a name to find people</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <AnimatePresence>
        {viewingMedia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-0 m-0"
          >
            {/* Header Controls */}
            <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent z-[110]">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setViewingMedia(null)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
                >
                  <ArrowLeft size={24} />
                </button>
                <div className="text-white">
                  <p className="font-bold text-sm">
                    {viewingMedia.type === 'profile' 
                      ? ((groups.find(g => g.id === viewingMedia.id) as any)?.display_name || 'Profile') 
                      : (viewingMedia.type === 'video' ? 'Video' : 'Photo')}
                  </p>
                  {viewingMedia.type !== 'profile' && viewingMedia.id && (
                    <p className="text-[10px] text-white/40">
                      {groups.find(g => g.id === viewingMedia.id)?.name || 'Shared Media'}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = viewingMedia.url;
                    link.download = `media_${Date.now()}`;
                    link.click();
                  }}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
                >
                  <Paperclip size={20} className="rotate-45" />
                </button>
                <button 
                  onClick={() => setViewingMedia(null)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <motion.div
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.7}
              onDragEnd={(_, info) => {
                if (Math.abs(info.offset.y) > 150) {
                  setViewingMedia(null);
                }
              }}
              className="w-full h-full flex items-center justify-center p-4 relative"
            >
              {viewingMedia.type === 'image' || viewingMedia.type === 'profile' ? (
                <motion.img
                  layoutId={`avatar-${viewingMedia.id}`}
                  src={viewingMedia.url}
                  className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain z-10 select-none"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  whileHover={{ scale: 1.02 }}
                />
              ) : (
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="w-full max-w-4xl max-h-[80vh] flex items-center justify-center"
                >
                  <video 
                    src={viewingMedia.url} 
                    controls 
                    autoPlay 
                    className="max-w-full max-h-[80vh] rounded-xl shadow-2xl"
                  />
                </motion.div>
              )}
            </motion.div>
            
            <div className="absolute bottom-8 left-0 right-0 flex justify-center text-white/40 text-[10px] uppercase tracking-widest font-bold pointer-events-none">
              Swipe up or down to close
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
