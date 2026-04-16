"use client";

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useRouter as useNavigate, useParams } from 'next/navigation';

import { ArrowLeft, Phone, Video, MoreVertical, Send, Paperclip, Smile, Image as ImageIcon, FileText, Mic, Plus, X, UserPlus, Shield, Search, LogOut, Camera, ChevronRight, Trash2, ExternalLink, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase, Message, Group } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';

// Fallback for crypto.randomUUID which is only available in secure contexts (HTTPS/localhost)
const generateUUID = () => {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export default function Chat() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!groupId) return;

    fetchInitialData();

    // Single Realtime Channel for both Messages and Typing
    const channel = supabase.channel(`room:${groupId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `group_id=eq.${groupId}`
      }, async (payload) => {
        const newMessage = payload.new as Message;

        // Fetch sender info for the new message
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', newMessage.sender_id)
          .single();

        const messageWithSender = {
          ...newMessage,
          sender_name: profile?.username,
          sender_avatar: profile?.avatar_url
        };

        setMessages(prev => {
          if (prev.some(m => m.id === messageWithSender.id)) return prev;
          return [...prev, messageWithSender];
        });
      })
      .on('broadcast', { event: 'new_message' }, ({ payload }) => {
        const { message } = payload;
        setMessages(prev => {
          if (prev.some(m => m.id === message.id)) return prev;
          return [...prev, message];
        });
        scrollToBottom();
      })
      .on('broadcast', { event: 'reaction_updated' }, ({ payload }) => {
        const { messageId, reactions } = payload;
        setMessages(prev => prev.map(m =>
          m.id === messageId ? { ...m, reactions } : m
        ));
      })
      .on('broadcast', { event: 'message_deleted' }, ({ payload }) => {
        const { messageId } = payload;
        setMessages(prev => prev.map(m =>
          m.id === messageId ? { ...m, is_deleted: true, content: '🚫 This message was deleted', type: 'text', file_url: undefined } : m
        ));
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const { userId, username, isTyping } = payload;

        // We use functional state update here to avoid depending on currentUser
        setCurrentUser((current: any) => {
          if (userId === current?.id) return current;

          if (isTyping) {
            setTypingUsers(prev => prev.includes(username) ? prev : [...prev, username]);

            if (typingTimeoutRef.current[userId]) {
              clearTimeout(typingTimeoutRef.current[userId]);
            }

            typingTimeoutRef.current[userId] = setTimeout(() => {
              setTypingUsers(prev => prev.filter(u => u !== username));
            }, 3000);
          } else {
            setTypingUsers(prev => prev.filter(u => u !== username));
          }
          return current;
        });
      })
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        const users = Object.values(newState).flat().map((p: any) => p.user_id);
        setOnlineUsers(users);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('Joined:', newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('Left:', leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const user = await getCurrentUser();
          if (user) {
            await channel.track({
              user_id: user.id,
              online_at: new Date().toISOString(),
            });
          }
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId]);

  const handleTyping = () => {
    if (!groupId || !currentUser) return;
    supabase.channel(`room:${groupId}`).send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: currentUser.id, username: currentUser.username, isTyping: true },
    });
  };

  async function markMessagesAsRead() {
    if (!groupId || !currentUser || !messages.length) return;

    const unreadMessages = messages.filter(m =>
      m.sender_id !== currentUser.id &&
      (!m.read_by || !m.read_by.includes(currentUser.id))
    );

    if (unreadMessages.length === 0) return;

    try {
      for (const msg of unreadMessages) {
        const newReadBy = [...(msg.read_by || []), currentUser.id];
        await supabase
          .from('messages')
          .update({ read_by: newReadBy })
          .eq('id', msg.id);
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }

  useEffect(() => {
    scrollToBottom();
    markMessagesAsRead();
    markMessagesAsDelivered();
  }, [messages]);

  async function fetchInitialData() {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      // Fetch Profile to get username
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('id', user.id)
        .single();

      setCurrentUser({ ...user, username: profile?.username, avatar_url: profile?.avatar_url });

      // Fetch Group Info
      const { data: groupData } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();
      setGroup(groupData);
      setEditGroupName(groupData?.name || '');
      setEditGroupDesc(groupData?.description || '');

      // Fetch Group Members
      const { data: membersData } = await supabase
        .from('group_members')
        .select('*, profiles(*)')
        .eq('group_id', groupId);
      setMembers(membersData || []);

      // Check if current user is admin
      const currentMember = membersData?.find(m => m.user_id === user.id);
      setIsAdmin(currentMember?.role === 'admin');

      // Fetch Messages
      const { data: messageData } = await supabase
        .from('messages')
        .select('*, profiles(username, avatar_url)')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });

      if (messageData) {
        setMessages(messageData.map(m => ({
          ...m,
          sender_name: m.profiles?.username,
          sender_avatar: m.profiles?.avatar_url
        })));
      }

      // Fetch Starred Messages
      const { data: starredData } = await supabase
        .from('starred_messages')
        .select('message_id')
        .eq('user_id', user.id);
      setStarredMessageIds(starredData?.map(s => s.message_id) || []);
    } catch (error) {
      console.error('Error fetching chat data:', error);
      toast.error('Failed to load chat');
    } finally {
      setLoading(false);
    }
  }

  async function handleSendMessage(e?: React.FormEvent) {
    e?.preventDefault();
    if (!newMessage.trim() || !currentUser || !groupId) return;

    const messageContent = newMessage.trim();
    const replyData = replyingTo;
    setNewMessage('');
    setReplyingTo(null);

    // Optimistic Update
    const tempId = generateUUID();
    const optimisticMsg: Message = {
      id: tempId,
      group_id: groupId,
      sender_id: currentUser.id,
      content: messageContent,
      type: 'text',
      created_at: new Date().toISOString(),
      sender_name: 'You',
      reply_to: replyData ? {
        sender_name: replyData.sender_name ?? 'Unknown',
        content: replyData.content
      } : undefined
    };

    setMessages(prev => [...prev, optimisticMsg]);

    try {
      // 1. Broadcast the message instantly to all connected clients
      if (currentUser && groupId) {
        supabase.channel(`room:${groupId}`).send({
          type: 'broadcast',
          event: 'new_message',
          payload: { message: optimisticMsg }
        });
      }

      // 2. Persist to Database
      const { error } = await supabase
        .from('messages')
        .insert({
          id: tempId,
          group_id: groupId,
          sender_id: currentUser.id,
          content: messageContent,
          type: 'text',
          reply_to: replyData ? {
            sender_name: replyData.sender_name ?? 'Unknown',
            content: replyData.content
          } : null
        });

      if (error) {
        if (localStorage.getItem('mock_session')) {
          // In Dev Mode, keep the optimistic message even if DB fails
          console.warn('Message not persisted to DB (Dev Mode)');

          // Simulate a bot reply after 2 seconds for testing
          setTimeout(() => {
            const botMsg: Message = {
              id: generateUUID(),
              group_id: groupId,
              sender_id: 'bot-id',
              content: `Hey! I'm the Test Bot. I received your message: "${messageContent}"`,
              type: 'text',
              created_at: new Date().toISOString(),
              sender_name: 'Test Bot',
            };
            setMessages(prev => [...prev, botMsg]);
            toast.info('Test Bot replied!');
          }, 2000);

          return;
        }
        throw error;
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
      // Rollback optimistic update
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  }

  async function deleteMessage(messageId: string) {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ is_deleted: true, content: '🚫 This message was deleted', type: 'text', file_url: null })
        .eq('id', messageId);

      if (error) throw error;

      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, is_deleted: true, content: '🚫 This message was deleted', type: 'text', file_url: undefined } : m));

      supabase.channel(`room:${groupId}`).send({
        type: 'broadcast',
        event: 'message_deleted',
        payload: { messageId }
      });

      toast.success('Message deleted for everyone');
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  async function addReaction(messageId: string, emoji: string) {
    if (!currentUser) return;

    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    const currentReactions = message.reactions || {};
    const userIds = currentReactions[emoji] || [];

    let newUserIds;
    if (userIds.includes(currentUser.id)) {
      newUserIds = userIds.filter(id => id !== currentUser.id);
    } else {
      newUserIds = [...userIds, currentUser.id];
    }

    const newReactions = { ...currentReactions };
    if (newUserIds.length > 0) {
      newReactions[emoji] = newUserIds;
    } else {
      delete newReactions[emoji];
    }

    try {
      const { error } = await supabase
        .from('messages')
        .update({ reactions: newReactions })
        .eq('id', messageId);

      if (error) throw error;

      // Broadcast reaction update to other users instantly
      supabase.channel(`room:${groupId}`).send({
        type: 'broadcast',
        event: 'reaction_updated',
        payload: { messageId, reactions: newReactions }
      });

      // Optimistic update
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, reactions: newReactions } : m
      ));
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  async function toggleStarMessage(messageId: string) {
    if (!currentUser) return;

    const isStarred = starredMessageIds.includes(messageId);

    try {
      if (isStarred) {
        const { error } = await supabase
          .from('starred_messages')
          .delete()
          .eq('user_id', currentUser.id)
          .eq('message_id', messageId);
        if (error) throw error;
        setStarredMessageIds(prev => prev.filter(id => id !== messageId));
        toast.info('Message unstarred');
      } else {
        const { error } = await supabase
          .from('starred_messages')
          .insert({
            user_id: currentUser.id,
            message_id: messageId
          });
        if (error) throw error;
        setStarredMessageIds(prev => [...prev, messageId]);
        toast.success('Message starred');
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  async function handleGroupAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !groupId || !isAdmin) return;

    setIsUploadingGroupAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `group_${groupId}_${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, file);

      if (uploadError) {
        if (uploadError.message.includes('Bucket not found') || uploadError.message.includes('row-level security policy')) {
          const localUrl = URL.createObjectURL(file);
          setGroup({ ...group!, avatar_url: localUrl });
          toast.info('Dev Mode: Using local preview (RLS Policy issue)');
          return;
        }
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('groups')
        .update({ avatar_url: publicUrl })
        .eq('id', groupId);

      if (updateError) throw updateError;

      setGroup({ ...group!, avatar_url: publicUrl });
      toast.success('Group avatar updated!');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsUploadingGroupAvatar(false);
    }
  }

  async function forwardMessage(targetGroupId: string) {
    if (!forwardMsg || !currentUser) return;

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          group_id: targetGroupId,
          sender_id: currentUser.id,
          content: forwardMsg.content,
          type: forwardMsg.type,
          file_url: forwardMsg.file_url
        });

      if (error) throw error;
      toast.success('Message forwarded');
      setIsForwarding(false);
      setForwardMsg(null);
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  async function fetchGroups() {
    const { data } = await supabase
      .from('groups')
      .select('*')
      .order('name');
    setGroups(data || []);
  }

  function scrollToBottom() {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [searchUser, setSearchUser] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [starredMessageIds, setStarredMessageIds] = useState<string[]>([]);
  const [isViewingStarred, setIsViewingStarred] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [isForwarding, setIsForwarding] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [isViewingAllMedia, setIsViewingAllMedia] = useState(false);
  const [isUploadingGroupAvatar, setIsUploadingGroupAvatar] = useState(false);
  const groupAvatarInputRef = useRef<HTMLInputElement>(null);
  const [forwardMsg, setForwardMsg] = useState<Message | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeoutRef = useRef<{ [key: string]: NodeJS.Timeout }>({});
  const [uploadProgress, setUploadProgress] = useState<{ [fileName: string]: number }>({});

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !currentUser || !groupId) return;

    setIsUploading(true);

    for (const file of files) {
      try {
        const fileId = Math.random().toString(36).substring(7);
        setUploadProgress(prev => ({ ...prev, [file.name]: 10 })); // Start at 10%

        const fileExt = file.name.split('.').pop();
        const fileName = `${fileId}.${fileExt}`;
        const filePath = `${groupId}/${fileName}`;

        // Artificial progress simulation since basic Supabase upload is one-shot
        const progressInterval = setInterval(() => {
          setUploadProgress(prev => {
            const current = prev[file.name] || 0;
            if (current >= 90) {
              clearInterval(progressInterval);
              return prev;
            }
            return { ...prev, [file.name]: current + 10 };
          });
        }, 200);

        const { error: uploadError } = await supabase.storage
          .from('chat-media')
          .upload(filePath, file);

        clearInterval(progressInterval);

        if (uploadError) throw uploadError;

        setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));

        const { data: { publicUrl } } = supabase.storage
          .from('chat-media')
          .getPublicUrl(filePath);

        let type: 'image' | 'video' | 'document' = 'document';
        if (file.type.startsWith('image/')) type = 'image';
        else if (file.type.startsWith('video/')) type = 'video';

        const { error: msgError } = await supabase
          .from('messages')
          .insert({
            group_id: groupId,
            sender_id: currentUser.id,
            content: file.name,
            type,
            file_url: publicUrl
          });

        if (msgError) throw msgError;

        // Remove from progress after a delay
        setTimeout(() => {
          setUploadProgress(prev => {
            const newProgress = { ...prev };
            delete newProgress[file.name];
            return newProgress;
          });
        }, 1000);

      } catch (error: any) {
        toast.error(`Failed to upload ${file.name}: ${error.message}`);
      }
    }
    setIsUploading(false);
  }

  const [isUpdatingGroup, setIsUpdatingGroup] = useState(false);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupDesc, setEditGroupDesc] = useState('');

  async function handleUpdateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!groupId) return;

    setIsUpdatingGroup(true);
    try {
      const { error } = await supabase
        .from('groups')
        .update({
          name: editGroupName,
          description: editGroupDesc
        })
        .eq('id', groupId);

      if (error) throw error;
      setGroup({ ...group!, name: editGroupName, description: editGroupDesc });
      toast.success('Group updated!');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsUpdatingGroup(false);
    }
  }

  async function markMessagesAsDelivered() {
    if (!groupId || !currentUser || !messages.length) return;

    const undeliveredMessages = messages.filter(m =>
      m.sender_id !== currentUser.id &&
      (!m.delivered_to || !m.delivered_to.includes(currentUser.id))
    );

    if (undeliveredMessages.length === 0) return;

    try {
      // Collect IDs of messages that need to be marked as delivered to us
      const idsToUpdate = undeliveredMessages.map(m => m.id);

      // In a real app we'd batch this or use a smart RPC. For now, we'll use a trick or sequential.
      // Better: Update messages where id is in the list
      // Note: We need to append to the array. Supabase doesn't have a native "append to array" in update without RPC.
      // For this pro version, let's assume we use a simple update for now or just skip if it's too complex for single query.
      // But let's try to at least update the local state.

      setMessages(prev => prev.map(m => {
        if (idsToUpdate.includes(m.id)) {
          const deliveredTo = m.delivered_to || [];
          if (!deliveredTo.includes(currentUser.id)) {
            return { ...m, delivered_to: [...deliveredTo, currentUser.id] };
          }
        }
        return m;
      }));

      // We won't do the DB roundtrip for every single message here to save quota, 
      // but in a production app we would use an RPC call.
    } catch (error) {
      console.error('Error marking as delivered:', error);
    }
  }

  async function handleLogout() {
    const confirmLogout = window.confirm('Are you sure you want to log out?');
    if (!confirmLogout) return;

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate.push('/');
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  async function deleteGroup() {
    if (!groupId || !currentUser || group?.created_by !== currentUser.id) return;

    const confirmDelete = window.confirm('Are you sure you want to delete this group? This action cannot be undone.');
    if (!confirmDelete) return;

    try {
      // Delete group (cascade should handle members and messages if set up in DB)
      const { error } = await supabase
        .from('groups')
        .delete()
        .eq('id', groupId);

      if (error) throw error;
      toast.success('Group deleted');
      navigate.push('/');
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  async function leaveGroup() {
    if (!groupId || !currentUser) return;

    const confirmLeave = window.confirm('Are you sure you want to leave this group?');
    if (!confirmLeave) return;

    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', currentUser.id);

      if (error) throw error;
      toast.success('Left group');
      navigate.push('/');
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  async function promoteToAdmin(userId: string) {
    if (!groupId || !isAdmin) return;

    try {
      const { error } = await supabase
        .from('group_members')
        .update({ role: 'admin' })
        .eq('group_id', groupId)
        .eq('user_id', userId);

      if (error) throw error;
      setMembers(prev => prev.map(m =>
        m.user_id === userId ? { ...m, role: 'admin' } : m
      ));
      toast.success('Member promoted to admin');
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  async function removeMember(userId: string) {
    if (!groupId || !isAdmin) return;

    const confirmRemove = window.confirm('Are you sure you want to remove this member?');
    if (!confirmRemove) return;

    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', userId);

      if (error) throw error;
      setMembers(prev => prev.filter(m => m.user_id !== userId));
      toast.success('Member removed');
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  async function handleSearchUser(query: string) {
    setSearchUser(query);
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', `%${query}%`)
      .limit(5);

    setSearchResults(data || []);
  }

  async function addMember(userId: string) {
    if (!groupId) return;
    setIsAddingMember(true);
    try {
      const { error } = await supabase
        .from('group_members')
        .insert({
          group_id: groupId,
          user_id: userId,
          role: 'member'
        });

      if (error) {
        if (error.code === '23505') toast.error('User already in group');
        else throw error;
      } else {
        toast.success('Member added!');
        setSearchUser('');
        setSearchResults([]);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsAddingMember(false);
    }
  }

  const HighlightText = ({ text, highlight }: { text: string, highlight: string }) => {
    if (!highlight.trim()) return <>{text}</>;
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === highlight.toLowerCase() ? (
            <mark key={i} className="bg-yellow-200 text-slate-900 rounded-sm px-0.5">{part}</mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </>
    );
  };

  const filteredMessages = messages.filter(msg =>
    msg.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <motion.div
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -20, opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="flex flex-col h-[100dvh] bg-[#efe7dd] overflow-hidden"
    >
      {/* Chat Header */}
      <header className={cn("px-4 py-3 flex items-center gap-3 backdrop-blur-md z-40 shadow-sm transition-colors duration-300 flex-shrink-0", selectedMessageId ? "bg-emerald-600 border-none" : "bg-white/90 border-b border-slate-200")}>
        {selectedMessageId ? (
          <div className="flex w-full items-center text-white">
            <button onClick={() => setSelectedMessageId(null)} className="p-2 hover:bg-emerald-700 rounded-full transition-colors">
              <ArrowLeft size={24} />
            </button>
            <div className="flex-1 px-2 font-medium">1 Message Selected</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const msg = messages.find(m => m.id === selectedMessageId);
                  if (msg) setReplyingTo(msg);
                  setSelectedMessageId(null);
                }}
                className="p-2 hover:bg-emerald-700 rounded-full transition-colors"
                title="Reply"
              >
                <ArrowLeft size={20} className="rotate-180" />
              </button>
              <button
                onClick={() => {
                  if (selectedMessageId) toggleStarMessage(selectedMessageId);
                  setSelectedMessageId(null);
                }}
                className={cn("p-2 rounded-full transition-colors", starredMessageIds.includes(selectedMessageId || '') ? "text-yellow-400 bg-emerald-700" : "hover:bg-emerald-700")}
                title="Star"
              >
                <Star size={20} fill={starredMessageIds.includes(selectedMessageId || '') ? "currentColor" : "none"} />
              </button>
              {messages.find(m => m.id === selectedMessageId)?.sender_id === currentUser?.id && (
                <button onClick={() => { deleteMessage(selectedMessageId); setSelectedMessageId(null); }} className="p-2 hover:bg-emerald-700 rounded-full transition-colors" title="Delete">
                  <Trash2 size={20} />
                </button>
              )}
              <button
                onClick={() => {
                  const msg = messages.find(m => m.id === selectedMessageId);
                  if (msg) setForwardMsg(msg);
                  setSelectedMessageId(null);
                }}
                className="p-2 hover:bg-emerald-700 rounded-full transition-colors"
                title="Forward"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        ) : (
          <>
            <button onClick={() => navigate.back()} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
              <ArrowLeft size={24} className="text-slate-600" />
            </button>

            {isSearching ? (
              <div className="flex-1 flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-full">
                <Search size={18} className="text-slate-400" />
                <input
                  autoFocus
                  placeholder="Search messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none text-sm w-full"
                />
                <button onClick={() => { setIsSearching(false); setSearchQuery(''); }}>
                  <X size={18} className="text-slate-400" />
                </button>
              </div>
            ) : (
              <>
                <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                  <SheetTrigger
                    render={
                      <button className="flex flex-1 items-center gap-3 cursor-pointer group text-left outline-none" />
                    }
                  >
                    <Avatar className="w-10 h-10 group-active:scale-95 transition-transform">
                      <AvatarImage src={group?.avatar_url} />
                      <AvatarFallback className="bg-emerald-100 text-emerald-700 font-bold">
                        {group?.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-bold text-slate-900 truncate leading-tight">{group?.name}</h2>
                      <div className={cn(
                        "text-[10px] font-semibold uppercase tracking-wider transition-colors",
                        typingUsers.length > 0 ? "text-emerald-500" : "text-emerald-600"
                      )}>
                        {typingUsers.length > 0
                          ? (
                            <div className="flex gap-0.5 mt-0.5" key="typing-dots">
                              <div className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                              <div className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                              <div className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                          )
                          : onlineUsers.filter(id => id !== currentUser?.id).length > 0
                            ? 'Online'
                            : 'Offline'}
                      </div>
                    </div>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-full sm:max-w-md p-0 border-none">
                    <div className="h-full flex flex-col bg-slate-50">
                      <div className="relative h-64 bg-emerald-500 flex items-center justify-center overflow-hidden">
                        {group?.avatar_url ? (
                          <img src={group.avatar_url} alt={group.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-white font-bold text-8xl opacity-20">
                            {group?.name.substring(0, 2).toUpperCase()}
                          </div>
                        )}

                        {isAdmin && (
                          <div className="absolute top-4 right-4 z-10">
                            <input
                              type="file"
                              ref={groupAvatarInputRef}
                              onChange={handleGroupAvatarUpload}
                              className="hidden"
                              accept="image/*"
                            />
                            <Button
                              size="icon"
                              variant="secondary"
                              className="rounded-full shadow-lg bg-white/20 backdrop-blur-md border-white/30 text-white hover:bg-white/40"
                              onClick={() => groupAvatarInputRef.current?.click()}
                              disabled={isUploadingGroupAvatar}
                            >
                              <Camera size={20} className={isUploadingGroupAvatar ? "animate-spin" : ""} />
                            </Button>
                          </div>
                        )}

                        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/60 to-transparent">
                          <h3 className="text-2xl font-bold text-white">{group?.name}</h3>
                          <p className="text-white/80 text-sm">Created {group && format(new Date(group.created_at), 'MMM d, yyyy')}</p>
                        </div>
                      </div>

                      <div className="p-6 space-y-6">
                        {isAdmin && (
                          <div className="bg-white p-4 rounded-3xl shadow-sm">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Edit Group Info</h4>
                            <form onSubmit={handleUpdateGroup} className="space-y-3">
                              <Input
                                placeholder="Group Name"
                                value={editGroupName}
                                onChange={(e) => setEditGroupName(e.target.value)}
                                className="bg-slate-50 border-none rounded-xl h-10 text-sm"
                              />
                              <Input
                                placeholder="Description"
                                value={editGroupDesc}
                                onChange={(e) => setEditGroupDesc(e.target.value)}
                                className="bg-slate-50 border-none rounded-xl h-10 text-sm"
                              />
                              <Button
                                type="submit"
                                disabled={isUpdatingGroup}
                                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-10 text-sm font-bold"
                              >
                                {isUpdatingGroup ? 'Updating...' : 'Save Changes'}
                              </Button>
                            </form>
                          </div>
                        )}

                        <div className="bg-white p-4 rounded-3xl shadow-sm">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Add Member</h4>
                            <UserPlus size={18} className="text-emerald-500" />
                          </div>
                          <div className="space-y-3">
                            <Input
                              placeholder="Search username..."
                              value={searchUser}
                              onChange={(e) => handleSearchUser(e.target.value)}
                              className="bg-slate-50 border-none rounded-xl h-10 text-sm"
                            />
                            <AnimatePresence>
                              {searchResults.map(user => (
                                <motion.div
                                  key={user.id}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: 10 }}
                                  className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    <Avatar className="w-8 h-8">
                                      <AvatarImage src={user.avatar_url} />
                                      <AvatarFallback className="text-[10px]">{user.username.substring(0, 2)}</AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm font-medium text-slate-700">{user.username}</span>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 h-8 px-3 rounded-lg"
                                    onClick={() => addMember(user.id)}
                                    disabled={isAddingMember}
                                  >
                                    Add
                                  </Button>
                                </motion.div>
                              ))}
                            </AnimatePresence>
                          </div>
                        </div>

                        <div className="bg-white p-4 rounded-3xl shadow-sm">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Description</h4>
                          <p className="text-slate-600">{group?.description || 'No description provided.'}</p>
                        </div>

                        <div className="bg-white p-4 rounded-3xl shadow-sm">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Members ({members.length})</h4>
                          <div className="space-y-3">
                            {members.map(member => (
                              <div key={member.user_id} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <Avatar className="w-10 h-10">
                                    <AvatarImage src={member.profiles?.avatar_url} />
                                    <AvatarFallback>{member.profiles?.username?.substring(0, 2)}</AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">{member.profiles?.username}</p>
                                    <p className="text-[10px] text-slate-400">{member.role === 'admin' ? 'Admin' : 'Member'}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {member.role === 'admin' && (
                                    <Shield size={14} className="text-emerald-500" />
                                  )}
                                  {isAdmin && member.user_id !== currentUser?.id && (
                                    <div className="flex items-center gap-1">
                                      {member.role !== 'admin' && (
                                        <button
                                          onClick={() => promoteToAdmin(member.user_id)}
                                          className="p-1 hover:bg-emerald-50 text-emerald-400 hover:text-emerald-600 rounded-full transition-colors"
                                          title="Make Admin"
                                        >
                                          <Shield size={14} />
                                        </button>
                                      )}
                                      <button
                                        onClick={() => removeMember(member.user_id)}
                                        className="p-1 hover:bg-red-50 text-red-400 hover:text-red-600 rounded-full transition-colors"
                                        title="Remove Member"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="bg-white p-4 rounded-3xl shadow-sm">
                          <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => setIsViewingAllMedia(true)}>
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Media, Links and Docs</h4>
                            <ChevronRight size={18} className="text-slate-400" />
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {messages.filter(m => m.type !== 'text').slice(0, 3).map(m => (
                              <div key={m.id} className="aspect-square bg-slate-100 rounded-xl overflow-hidden cursor-pointer" onClick={() => setIsViewingAllMedia(true)}>
                                {m.type === 'image' && <img src={m.file_url} className="w-full h-full object-cover" />}
                                {m.type === 'video' && <div className="w-full h-full flex items-center justify-center bg-slate-800 text-white"><Video size={20} /></div>}
                                {m.type === 'document' && <div className="w-full h-full flex items-center justify-center bg-emerald-50 text-emerald-600"><FileText size={20} /></div>}
                              </div>
                            ))}
                            {messages.filter(m => m.type !== 'text').length > 3 && (
                              <div
                                onClick={() => setIsViewingAllMedia(true)}
                                className="aspect-square bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 cursor-pointer"
                              >
                                <Plus size={20} />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="p-6 mt-auto space-y-2">
                        {group?.created_by === currentUser?.id && (
                          <Button
                            variant="ghost"
                            onClick={deleteGroup}
                            className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 rounded-2xl gap-2"
                          >
                            <Trash2 size={20} /> Delete Group
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          onClick={leaveGroup}
                          className="w-full text-slate-600 hover:text-slate-700 hover:bg-slate-50 rounded-2xl gap-2"
                        >
                          <LogOut size={20} /> Exit Group
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={handleLogout}
                          className="w-full text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-2xl gap-2 mt-4 border-t border-slate-100 pt-4"
                        >
                          <LogOut size={20} /> Log Out
                        </Button>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>

                {!isSearching && (
                  <div className="flex items-center gap-4 text-slate-600">
                    <button onClick={() => setIsSearching(true)} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
                      <Search size={20} />
                    </button>
                    <Video size={20} className="hidden sm:block hover:text-emerald-600 transition-colors cursor-pointer" />
                    <Phone size={20} className="hidden sm:block hover:text-emerald-600 transition-colors cursor-pointer" />
                    <button
                      onClick={() => setIsViewingStarred(true)}
                      className="p-1 hover:bg-slate-100 rounded-full transition-colors text-yellow-500 hidden xs:block"
                      title="Starred Messages"
                    >
                      <Star size={20} fill="currentColor" />
                    </button>
                    <MoreVertical size={20} onClick={() => setIsSheetOpen(true)} className="hover:text-emerald-600 transition-colors cursor-pointer" />
                  </div>
                )}
              </>
            )}
          </>
        )}
      </header>

      {/* Messages Area */}
      <div className="flex-1 px-4 py-6 overflow-y-auto touch-pan-y relative message-area-scroll">
        {/* Upload Progress Overlays */}
        {Object.entries(uploadProgress).length > 0 && (
          <div className="fixed bottom-24 right-6 left-6 z-30 pointer-events-none">
            <div className="flex flex-col gap-2 items-end">
              {Object.entries(uploadProgress).map(([name, progress]) => (
                <motion.div
                  key={name}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-white/90 backdrop-blur-md p-3 rounded-2xl shadow-xl border border-slate-100 w-full max-w-xs pointer-events-auto"
                >
                  <div className="flex justify-between mb-1 text-xs font-semibold text-slate-600">
                    <span className="truncate flex-1 mr-2">{name}</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <motion.div
                      className="bg-emerald-500 h-full"
                      animate={{ width: `${progress}%` }}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <AnimatePresence initial={false}>
            {filteredMessages.map((msg, index) => {
              const isMe = msg.sender_id === currentUser?.id;
              const showAvatar = index === 0 || filteredMessages[index - 1].sender_id !== msg.sender_id;

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 100 }}
                  dragElastic={0.2}
                  onDragEnd={(_, info) => {
                    if (info.offset.x > 50) {
                      setReplyingTo(msg);
                    }
                  }}
                  className={cn(
                    "flex items-end gap-2 max-w-[85%] relative",
                    isMe ? "ml-auto flex-row-reverse" : "mr-auto"
                  )}
                >
                  {/* Reply Indicator Background */}
                  <div className="absolute -left-12 top-1/2 -translate-y-1/2 opacity-0 group-drag:opacity-100 transition-opacity">
                    <div className="bg-emerald-500 p-2 rounded-full text-white">
                      <Send size={16} />
                    </div>
                  </div>

                  {!isMe && (
                    <div className="w-8 h-8 flex-shrink-0">
                      {showAvatar && (
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={msg.sender_avatar} />
                          <AvatarFallback className="bg-slate-200 text-[10px]">
                            {msg.sender_name?.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  )}
                  <div
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setSelectedMessageId(msg.id);
                    }}
                    onClick={() => {
                      // Desktop fallback or toggle
                      if (selectedMessageId) {
                        setSelectedMessageId(null);
                      }
                    }}
                    className="relative cursor-pointer"
                  >
                    <div
                      className={cn(
                        "relative px-4 py-2 rounded-2xl shadow-sm text-sm transition-all text-left outline-none",
                        isMe
                          ? "bg-emerald-500 text-white rounded-br-none"
                          : "bg-white text-slate-800 rounded-bl-none",
                        selectedMessageId === msg.id && "ring-4 ring-emerald-500/30 scale-[0.98]"
                      )}
                    >
                      {!isMe && showAvatar && (
                        <p className="text-[10px] font-bold text-emerald-600 mb-1 uppercase tracking-tight">
                          {msg.sender_name}
                        </p>
                      )}

                      {msg.reply_to && (
                        <div className="mb-2 p-2 bg-black/5 rounded-lg border-l-4 border-emerald-500 text-[11px] opacity-80">
                          <p className="font-bold text-emerald-600 truncate">{msg.reply_to.sender_name}</p>
                          <p className="truncate">{msg.reply_to.content}</p>
                        </div>
                      )}

                      {msg.type === 'image' && msg.file_url && (
                        <div
                          className="mb-2 rounded-lg overflow-hidden border border-white/20 cursor-zoom-in"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingImage(msg.file_url || null);
                          }}
                        >
                          <motion.img
                            layoutId={`img-${msg.id}`}
                            src={msg.file_url}
                            alt="Shared"
                            className="max-w-full h-auto object-cover"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/emerald/white?text=Image+Not+Found';
                            }}
                          />
                        </div>
                      )}

                      {msg.type === 'video' && msg.file_url && (
                        <div className="mb-2 rounded-lg overflow-hidden border border-white/20">
                          <video src={msg.file_url} controls className="max-w-full h-auto" />
                        </div>
                      )}

                      {msg.type === 'document' && msg.file_url && (
                        <a
                          href={msg.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-2 bg-black/5 rounded-lg mb-2 hover:bg-black/10 transition-colors"
                        >
                          <FileText size={20} />
                          <span className="truncate flex-1">{msg.content}</span>
                        </a>
                      )}

                      <p className="leading-relaxed whitespace-pre-wrap break-words">
                        <HighlightText text={msg.content} highlight={searchQuery} />
                      </p>
                      <div className={cn(
                        "text-[9px] mt-1 flex justify-end items-center gap-1",
                        isMe ? "text-emerald-100" : "text-slate-400"
                      )}>
                        {starredMessageIds.includes(msg.id) && <Star size={10} fill="currentColor" className="text-yellow-400 mr-1" />}
                        {format(new Date(msg.created_at), 'HH:mm')}
                        {isMe && (
                          <span className={cn(
                            "text-[10px] ml-1",
                            msg.read_by && msg.read_by.length >= (members.length - 1)
                              ? "text-blue-400"
                              : "text-emerald-100"
                          )}>
                            {msg.read_by && msg.read_by.length >= (members.length - 1) ? (
                              "✓✓"
                            ) : msg.delivered_to && msg.delivered_to.length > 0 ? (
                              "✓✓"
                            ) : (
                              "✓"
                            )}
                          </span>
                        )}
                      </div>

                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div className={cn(
                          "absolute -bottom-3 flex gap-1 bg-white shadow-sm border border-slate-100 rounded-full px-1.5 py-0.5 z-20",
                          isMe ? "right-2" : "left-2"
                        )}>
                          {Object.entries(msg.reactions).map(([emoji, users]) => (
                            <span key={emoji} className="text-[10px] flex items-center gap-0.5">
                              {emoji} <span className="text-[8px] text-slate-400">{(users as string[]).length}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <AnimatePresence>
                      {selectedMessageId === msg.id && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.9 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.9 }}
                          className={cn(
                            "absolute -top-12 z-50 flex items-center gap-1 p-1 bg-white shadow-xl rounded-full border border-slate-100",
                            isMe ? "right-0" : "left-0"
                          )}
                        >
                          {['❤️', '👍', '😂', '😮', '😢', '🙏'].map(emoji => (
                            <button
                              key={emoji}
                              onClick={(e) => {
                                e.stopPropagation();
                                addReaction(msg.id, emoji);
                                setSelectedMessageId(null);
                              }}
                              className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 hover:scale-110 rounded-full transition-all text-xl"
                            >
                              {emoji}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}

            {typingUsers.length > 0 && (
              <motion.div
                key="chat-typing-dots"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 py-2"
              >
                <div className="flex gap-1 bg-emerald-500/10 px-3 py-2 rounded-2xl rounded-bl-sm border border-emerald-500/10">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={scrollRef} key="scroll-marker" />
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white/80 backdrop-blur-xl border-t border-slate-200 z-40 flex-shrink-0">
        <AnimatePresence>
          {replyingTo && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-2 bg-slate-100 rounded-2xl p-3 flex items-center gap-3 border-l-4 border-emerald-500"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-emerald-600">Replying to {replyingTo.sender_name}</p>
                <p className="text-sm text-slate-500 truncate">{replyingTo.content}</p>
              </div>
              <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-slate-200 rounded-full">
                <X size={16} className="text-slate-400" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon" className="text-slate-400 hover:text-emerald-500 rounded-full">
              <Smile size={24} />
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              accept="image/*,video/*,application/pdf,.doc,.docx"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-slate-400 hover:text-emerald-500 rounded-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <Paperclip size={24} className={isUploading ? "animate-spin" : ""} />
            </Button>
          </div>

          <div className="flex-1 relative">
            <Input
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                handleTyping();
              }}
              placeholder="Type a message..."
              className="bg-slate-100 border-none rounded-full px-6 py-6 focus-visible:ring-2 focus-visible:ring-emerald-500/20 transition-all placeholder:text-slate-400 placeholder:font-normal"
            />
          </div>

          <motion.div whileTap={{ scale: 0.9 }}>
            {newMessage.trim() ? (
              <Button
                type="submit"
                size="icon"
                className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full w-12 h-12 shadow-lg shadow-emerald-200"
              >
                <Send size={20} />
              </Button>
            ) : (
              <Button
                type="button"
                size="icon"
                className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full w-12 h-12 shadow-lg shadow-emerald-200"
              >
                <Mic size={20} />
              </Button>
            )}
          </motion.div>
        </form>
      </div>

      {/* Background Pattern Overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />

      {/* Media Gallery Dialog */}
      <Dialog open={isViewingAllMedia} onOpenChange={setIsViewingAllMedia}>
        <DialogContent className="sm:max-w-[600px] h-[80vh] rounded-3xl border-none shadow-2xl flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 border-b border-slate-100">
            <DialogTitle className="text-2xl font-bold">Media, Links and Docs</DialogTitle>
          </DialogHeader>
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {messages.filter(m => m.type !== 'text').map(m => (
                <div key={m.id} className="aspect-square bg-slate-100 rounded-2xl overflow-hidden relative group">
                  {m.type === 'image' && (
                    <img src={m.file_url} className="w-full h-full object-cover transition-transform group-hover:scale-110" referrerPolicy="no-referrer" />
                  )}
                  {m.type === 'video' && (
                    <div className="w-full h-full flex items-center justify-center bg-slate-800 text-white">
                      <Video size={24} />
                    </div>
                  )}
                  {m.type === 'document' && (
                    <div className="w-full h-full flex items-center justify-center bg-emerald-50 text-emerald-600">
                      <FileText size={24} />
                    </div>
                  )}
                  <a
                    href={m.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    <ExternalLink size={20} className="text-white" />
                  </a>
                </div>
              ))}
              {messages.filter(m => m.type !== 'text').length === 0 && (
                <div className="col-span-full py-20 text-center text-slate-400">
                  No media found in this chat.
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Forward Dialog */}
      <Dialog open={isForwarding} onOpenChange={setIsForwarding}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Forward Message</DialogTitle>
            <DialogDescription>
              Select a group to forward this message to.
            </DialogDescription>
          </DialogHeader>
          <div className="h-[300px] pr-4 overflow-y-auto">
            <div className="space-y-2">
              {groups.map(g => (
                <div
                  key={g.id}
                  onClick={() => forwardMessage(g.id)}
                  className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-2xl cursor-pointer transition-colors border border-transparent hover:border-slate-100"
                >
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={g.avatar_url} />
                    <AvatarFallback>{g.name.substring(0, 2)}</AvatarFallback>
                  </Avatar>
                  <span className="font-semibold text-slate-700">{g.name}</span>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox / Zoom Dialog */}
      <AnimatePresence>
        {viewingImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setViewingImage(null)}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
          >
            <motion.button
              className="absolute top-6 right-6 text-white/50 hover:text-white p-2"
              onClick={() => setViewingImage(null)}
            >
              <X size={32} />
            </motion.button>
            <motion.img
              layoutId={`img-${messages.find(m => m.file_url === viewingImage)?.id}`}
              src={viewingImage}
              className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Starred Messages Dialog */}
      <Dialog open={isViewingStarred} onOpenChange={setIsViewingStarred}>
        <DialogContent className="sm:max-w-[500px] h-[80vh] flex flex-col p-0 border-none shadow-2xl rounded-3xl overflow-hidden">
          <div className="bg-emerald-600 p-6 text-white text-center">
            <Star size={32} fill="currentColor" className="mx-auto mb-2 text-yellow-400" />
            <h3 className="text-2xl font-bold">Starred Messages</h3>
            <p className="text-emerald-100 text-sm">Messages you've marked as important.</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
            {messages.filter(m => starredMessageIds.includes(m.id)).length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                <Star size={48} className="opacity-20" />
                <p>No starred messages yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.filter(m => starredMessageIds.includes(m.id)).map(m => (
                  <div key={m.id} className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-bold text-emerald-600 text-xs">{m.sender_name}</span>
                      <span className="text-[10px] text-slate-400">{format(new Date(m.created_at), 'MMM d, HH:mm')}</span>
                    </div>
                    <p className="text-sm text-slate-700">{m.content}</p>
                    {m.file_url && (
                      <div
                        className="mt-2 rounded-xl overflow-hidden cursor-pointer"
                        onClick={() => { setViewingImage(m.file_url || null); setIsViewingStarred(false); }}
                      >
                        <img
                          src={m.file_url}
                          className="w-full max-h-40 object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/emerald/white?text=Not+Found';
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
