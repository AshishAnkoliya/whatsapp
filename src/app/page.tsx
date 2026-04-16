"use client";

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useRouter as useNavigate } from 'next/navigation';

import { Search, Plus, MoreVertical, Camera, MessageSquare, X, RefreshCw } from 'lucide-react';
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
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchGroups();
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

      // Fetch last message for each group
      const groupsWithLastMessage = await Promise.all((groupsData || []).map(async (group) => {
        const { data: lastMsgData } = await supabase
          .from('messages')
          .select('content, created_at')
          .eq('group_id', group.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        return {
          ...group,
          last_message: lastMsgData?.content || null,
          last_message_time: lastMsgData?.created_at || group.created_at
        };
      }));

      setGroups(groupsWithLastMessage);
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setLoading(false);
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
                <div key={group.id} className="relative mb-1 overflow-hidden rounded-2xl">
                  {/* Delete Action Background */}
                  <div className="absolute inset-0 bg-red-500 flex items-center justify-end px-6">
                    <div className="flex flex-col items-center text-white">
                      <X size={20} />
                      <span className="text-[10px] font-bold">Delete</span>
                    </div>
                  </div>

                  <motion.div
                    drag="x"
                    dragConstraints={{ left: -100, right: 0 }}
                    dragElastic={0.1}
                    onDragEnd={(_, info) => {
                      if (info.offset.x < -70) {
                        // Handle delete logic here
                        toast.info("Delete functionality coming soon!");
                      }
                    }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => navigate.push(`/chat/${group.id}`)}
                    className="flex items-center gap-4 p-3 bg-white hover:bg-slate-50 cursor-pointer transition-all active:scale-[0.98] relative z-10"
                  >
                    <Avatar className="w-14 h-14 border-2 border-white shadow-sm">
                      <AvatarImage src={group.avatar_url} />
                      <AvatarFallback className="bg-emerald-100 text-emerald-700 font-bold text-lg">
                        {group.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 border-b border-slate-100 pb-3">
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="font-semibold text-slate-900 line-clamp-1">{group.name}</h3>
                        <span className="text-xs text-slate-400 font-medium">
                          {formatDistanceToNow(new Date((group as any).last_message_time || group.created_at), { addSuffix: false })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 line-clamp-1">
                        {(group as any).last_message || group.description || 'Tap to start chatting...'}
                      </p>
                    </div>
                  </motion.div>
                </div>
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
        <DialogContent className="sm:max-w-[425px] rounded-3xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">New Group</DialogTitle>
            <DialogDescription>
              Create a new space for your team or friends.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateGroup} className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Group Name</label>
              <Input
                placeholder="e.g. Design Team"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                required
                className="bg-slate-50 border-none rounded-xl h-12 focus-visible:ring-emerald-500/20"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Description (Optional)</label>
              <Input
                placeholder="What's this group about?"
                value={newGroupDesc}
                onChange={(e) => setNewGroupDesc(e.target.value)}
                className="bg-slate-50 border-none rounded-xl h-12 focus-visible:ring-emerald-500/20"
              />
            </div>
            <DialogFooter className="pt-4">
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
    </div>
  );
}
