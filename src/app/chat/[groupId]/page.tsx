"use client";

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useRouter as useNavigate, useParams } from 'next/navigation';

import { ArrowLeft, Phone, Video, MoreVertical, Send, Paperclip, Smile, Image as ImageIcon, FileText, Mic, Plus, X, UserPlus, Shield, Search, LogOut, Camera, ChevronRight, Trash2, ExternalLink, Star, Bell, BellOff, Check, CheckCheck, Pencil, RefreshCw } from 'lucide-react';

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
import { subscribeToPush } from '@/lib/push';


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
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [viewingReactionsMsg, setViewingReactionsMsg] = useState<Message | null>(null);
  const [activeReactionTab, setActiveReactionTab] = useState<string>('All');
  const [reactionProfiles, setReactionProfiles] = useState<Record<string, any>>({});
  const [isFetchingReactions, setIsFetchingReactions] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [isSubscribing, setIsSubscribing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [audioTime, setAudioTime] = useState(0);
  const [isAudioCancelled, setIsAudioCancelled] = useState(false);
  const [audioDragX, setAudioDragX] = useState(0);
  const [audioStartX, setAudioStartX] = useState(0);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // Click outside to close emoji picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const container = document.getElementById('emoji-picker-container');
      if (container && !container.contains(event.target as Node)) {
        setIsEmojiPickerOpen(false);
      }
    };

    if (isEmojiPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEmojiPickerOpen]);

  useEffect(() => {
    if (!groupId) return;

    fetchInitialData();
    checkNotificationPermission();
  }, [groupId]);

  async function checkNotificationPermission() {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }


  async function handleSubscribe() {
    if (!currentUser) return;
    setIsSubscribing(true);
    try {
      await subscribeToPush(currentUser.id);
      setNotificationPermission('granted');
      toast.success('Notifications enabled successfully!');
    } catch (error: any) {
      if (error.message !== 'Notification permission denied') {
        toast.error(error.message || 'Failed to enable notifications');
      }
    } finally {
      setIsSubscribing(false);
    }
  }


  useEffect(() => {
    if (!groupId || !currentUser) return;

    // Single Realtime Channel for both Messages and Typing
    const channel = supabase.channel(`room:${groupId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `group_id=eq.${groupId}`
      }, async (payload) => {
        const newMessage = payload.new as Message;
        if (newMessage.is_deleted) return; 

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
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `group_id=eq.${groupId}`
      }, (payload) => {
        const updatedMessage = payload.new as Message;
        if (updatedMessage.is_deleted) {
          setMessages(prev => prev.filter(m => m.id !== updatedMessage.id));
        } else {
          // Update message in local state (e.g. read_by or delivered_to changed)
          setMessages(prev => prev.map(m => 
            m.id === updatedMessage.id ? { ...m, ...updatedMessage } : m
          ));
        }
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
        console.log('Realtime status:', status);
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: currentUser.id,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, currentUser?.id]);

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
        // Ensure we handle it as a clean array for JSONB
        const currentReadBy = Array.isArray(msg.read_by) ? msg.read_by : [];
        const newReadBy = Array.from(new Set([...currentReadBy, currentUser.id]));
        
        const { error } = await supabase
          .from('messages')
          .update({ read_by: newReadBy })
          .eq('id', msg.id);
        
        if (error) {
          console.error(`Failed to mark msg ${msg.id} as read:`, error.message, error.details);
        }
      }
    } catch (error) {
      console.error('Error in markMessagesAsRead:', error);
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
      
      // Fetch Group Members
      const { data: membersData } = await supabase
        .from('group_members')
        .select('*, profiles(*)')
        .eq('group_id', groupId);
      const currentMembers = membersData || [];
      setMembers(currentMembers);

      // Resolve DM identity if needed
      let displayGroup = groupData;
      if (groupData?.type === 'dm') {
        const otherMember = currentMembers.find(m => m.user_id !== user.id);
        if (otherMember?.profiles) {
          displayGroup = {
            ...groupData,
            name: (otherMember.profiles as any).username,
            avatar_url: (otherMember.profiles as any).avatar_url
          };
        }
      }

      setGroup(displayGroup);
      setEditGroupName(displayGroup?.name || '');
      setEditGroupDesc(displayGroup?.description || '');

      // Check if current user is admin
      const currentMember = membersData?.find(m => m.user_id === user.id);
      setIsAdmin(currentMember?.role === 'admin');

      // Fetch Messages
      const { data: messageData } = await supabase
        .from('messages')
        .select('*, profiles(username, avatar_url)')
        .eq('group_id', groupId)
        .or('is_deleted.eq.false,is_deleted.is.null') // Filter out deleted messages
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

    if (editingMessage) {
      await handleUpdateMessage(editingMessage.id, newMessage);
      return;
    }

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
      sender_name: currentUser.username || 'Someone',
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
          payload: { 
            message: {
              ...optimisticMsg,
              sender_name: currentUser.username // Send real name to others
            } 
          }
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
          sender_name: currentUser.username,
          sender_avatar: currentUser.avatar_url,
          reply_to: replyData ? {
            sender_name: replyData.sender_id === currentUser.id ? currentUser.username : (replyData.sender_name ?? 'Unknown'),
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
      
      // 3. Trigger Push Notifications
      triggerPushNotification(`${currentUser.username || 'Someone'} (${group?.name})`, messageContent);
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

  async function handleUpdateMessage(messageId: string, newContent: string) {
    if (!newContent.trim() || !currentUser || !groupId) return;

    try {
      const editedAt = new Date().toISOString();
      const { error } = await supabase
        .from('messages')
        .update({ content: newContent.trim(), edited_at: editedAt })
        .eq('id', messageId);

      if (error) throw error;

      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, content: newContent.trim(), edited_at: editedAt } : m
      ));

      // Broadcast update
      supabase.channel(`room:${groupId}`).send({
        type: 'broadcast',
        event: 'message_updated',
        payload: { messageId, content: newContent.trim(), edited_at: editedAt }
      });

      setEditingMessage(null);
      setNewMessage('');
      toast.success('Message updated');
    } catch (error: any) {
      console.error('Error updating message:', error);
      toast.error('Failed to update message');
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

  async function triggerPushNotification(messageTitle: string, messageBody: string) {
    if (!groupId || !currentUser) return;

    console.log('--- Triggering Server-Side Push Notification ---');

    try {
      const response = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          senderId: currentUser.id,
          title: messageTitle,
          body: messageBody,
          url: window.location.href
        })
      });

      const result = await response.json();
      console.log('Server-Side Push Result:', result);
    } catch (err) {
      console.error('Trigger push top-level error:', err);
    }
  }

  async function fetchReactionProfiles(msg: Message) {
    if (!msg.reactions) return;
    
    // Extract unique user IDs from all reaction types
    const userIds = Array.from(new Set(
      Object.values(msg.reactions).flat()
    ));

    if (userIds.length === 0) return;

    // Filter out IDs already in cache
    const missingIds = userIds.filter(id => !reactionProfiles[id]);
    if (missingIds.length === 0) return;

    setIsFetchingReactions(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', missingIds);

      if (error) throw error;

      if (data) {
        const newProfiles = { ...reactionProfiles };
        data.forEach(profile => {
          newProfiles[profile.id] = profile;
        });
        setReactionProfiles(newProfiles);
      }
    } catch (error: any) {
      console.error('Error fetching reaction profiles:', error);
    } finally {
      setIsFetchingReactions(false);
    }
  }

  async function handleGroupAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      toast.error('No file selected');
      return;
    }
    
    if (!groupId) {
      toast.error('Group ID missing');
      return;
    }

    toast.info(`Selected: ${file.name}. Starting upload...`);
    setIsUploadingGroupAvatar(true);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `group_${groupId}_${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      toast.loading('Uploading to storage...', { id: 'group-upload' });
      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, file);

      if (uploadError) {
        toast.dismiss('group-upload');
        if (uploadError.message.includes('Bucket not found') || uploadError.message.includes('row-level security policy')) {
          const localUrl = URL.createObjectURL(file);
          setGroup({ ...group!, avatar_url: localUrl });
          toast.info('Dev Mode: Using preview (RLS Issue)');
          return;
        }
        throw uploadError;
      }

      toast.loading('Updating group records...', { id: 'group-upload' });
      const { data: { publicUrl } } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath);

      const { data: updateData, error: updateError } = await supabase
        .from('groups')
        .update({ avatar_url: publicUrl })
        .eq('id', groupId)
        .select();

      if (updateError) {
        console.error('Database Update Error:', updateError);
        throw new Error(`Database rejected the update: ${updateError.message}`);
      }

      // If no data returned, it means RLS blocked the update despite no error being thrown
      if (!updateData || updateData.length === 0) {
        console.warn('Update matched 0 rows. Check RLS policies or if you are the creator.');
        // We still show the local preview so the user isn't confused, but warn them
        setGroup(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
        toast.warning('Photo changed locally, but database permissions might be blocking the save.', { duration: 5000 });
      } else {
        setGroup(updateData[0]);
        toast.success('Group photo saved to database!', { id: 'group-upload' });
      }

      // Still re-fetch to stay in sync with any other server-side changes
      const { data: refreshedGroup } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();
      
      if (refreshedGroup) {
        setGroup(refreshedGroup);
        setEditGroupName(refreshedGroup.name);
        setEditGroupDesc(refreshedGroup.description || '');
      }

      // Insert system notification
      await supabase
        .from('messages')
        .insert({
          group_id: groupId,
          sender_id: currentUser.id,
          content: `[SYSTEM]: ${currentUser.username || 'Someone'} changed the group photo`,
          type: 'text'
        });
    } catch (error: any) {
      toast.dismiss('group-upload');
      toast.error(`Upload failed: ${error.message}`);
      console.error('Upload Error:', error);
    } finally {
      setIsUploadingGroupAvatar(false);
      if (e.target) e.target.value = ''; // Reset input
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
  const [viewingMedia, setViewingMedia] = useState<{ url: string, type: 'image' | 'video' | 'profile', id?: string } | null>(null);
  const [isViewingAllMedia, setIsViewingAllMedia] = useState(false);
  const [isUploadingGroupAvatar, setIsUploadingGroupAvatar] = useState(false);
  const groupAvatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCameraOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    }
  }, [isCameraOpen, facingMode]);

  const startCamera = async () => {
    try {
      if (cameraStream) stopCamera(); // Stop old stream before restarting
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: facingMode }, 
        audio: true 
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access error:", err);
      toast.error("Could not access camera. Please check permissions.");
      setIsCameraOpen(false);
    }
  };

  const switchCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const handleStartRecording = () => {
    if (!cameraStream) return;
    
    const chunks: Blob[] = [];
    const options = { mimeType: 'video/webm;codecs=vp9,opus' };
    
    try {
      const recorder = new MediaRecorder(cameraStream);
      mediaRecorderRef.current = recorder;
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const file = new File([blob], `video_${Date.now()}.mp4`, { type: 'video/mp4' });
        // Forward as a mock event to handleFileUpload
        handleFileUpload({ target: { files: [file] } } as any);
      };
      
      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Recording error:", err);
      toast.error("Recording failed to start.");
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
            // Mock file object for existing handleFileUpload
            const event = {
              target: {
                files: [file]
              }
            } as any;
            handleFileUpload(event);
            setIsCameraOpen(false);
          }
        }, 'image/jpeg', 0.9);
      }
    }
  };

  const startAudioRecording = async (e: React.MouseEvent | React.TouchEvent) => {
    try {
      const startX = 'clientX' in e ? e.clientX : e.touches[0].clientX;
      setAudioStartX(startX);
      setAudioDragX(0);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioRecorderRef.current = recorder;
      audioChunksRef.current = [];
      setIsAudioCancelled(false);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        if (!isAudioCancelled && audioChunksRef.current.length > 0) {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
          handleFileUpload({ target: { files: [file] } } as any);
        }
      };

      recorder.start();
      setIsRecordingAudio(true);
      setAudioTime(0);
      audioIntervalRef.current = setInterval(() => {
        setAudioTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Audio recording error:", err);
      toast.error("Could not access microphone.");
    }
  };

  const handleAudioPointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isRecordingAudio) return;
    const currentX = 'clientX' in e ? e.clientX : e.touches[0].clientX;
    const deltaX = currentX - audioStartX;
    setAudioDragX(deltaX);
    
    if (deltaX < -80) { // Slide threshold reached
      stopAudioRecording(true);
    }
  };

  const stopAudioRecording = (cancel = false) => {
    if (audioRecorderRef.current && isRecordingAudio) {
      setIsAudioCancelled(cancel);
      audioRecorderRef.current.stop();
      setIsRecordingAudio(false);
      setAudioTime(0);
      setAudioDragX(0);
      if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
    }
  };
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
        
        // Trigger Push Notification for file/media
        triggerPushNotification(
          `${currentUser.username || 'Someone'} (${group?.name})`,
          `Shared a ${type === 'image' ? 'photo' : type === 'video' ? 'video' : 'file'}: ${file.name}`
        );

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
      // Insert specific system notifications based on what changed
      if (group?.name !== editGroupName) {
        await supabase
          .from('messages')
          .insert({
            group_id: groupId,
            sender_id: currentUser.id,
            content: `[SYSTEM]: ${currentUser.username || 'Someone'} changed the group name to "${editGroupName}"`,
            type: 'text'
          });
      }
      
      if ((group?.description || '') !== editGroupDesc) {
        await supabase
          .from('messages')
          .insert({
            group_id: groupId,
            sender_id: currentUser.id,
            content: `[SYSTEM]: ${currentUser.username || 'Someone'} changed the group description`,
            type: 'text'
          });
      }
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
      (!m.delivered_to || (Array.isArray(m.delivered_to) && !m.delivered_to.includes(currentUser.id)))
    );

    if (undeliveredMessages.length === 0) return;

    try {
      const idsToUpdate = undeliveredMessages.map(m => m.id);

      // Optimistically update local state
      setMessages(prev => prev.map(m => {
        if (idsToUpdate.includes(m.id)) {
          const currentDeliveredTo = Array.isArray(m.delivered_to) ? m.delivered_to : [];
          const deliveredTo = Array.from(new Set([...currentDeliveredTo, currentUser.id]));
          return { ...m, delivered_to: deliveredTo };
        }
        return m;
      }));

      // Update in DB
      await Promise.all(undeliveredMessages.map(async (msg) => {
        const currentDeliveredTo = Array.isArray(msg.delivered_to) ? msg.delivered_to : [];
        const newDeliveredTo = Array.from(new Set([...currentDeliveredTo, currentUser.id]));
        
        const { error } = await supabase
          .from('messages')
          .update({ delivered_to: newDeliveredTo })
          .eq('id', msg.id);
          
        if (error) {
          console.error(`Failed to mark msg ${msg.id} as delivered:`, error.message, error.details);
        }
      }));
    } catch (error) {
      console.error('Error in markMessagesAsDelivered:', error);
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

        // Fetch new member's name for the notification
        const { data: userData } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', userId)
          .single();

        // Insert system notification
        await supabase
          .from('messages')
          .insert({
            group_id: groupId,
            sender_id: currentUser.id,
            content: `[SYSTEM]: ${currentUser.username || 'Someone'} added ${userData?.username || 'a new member'}`,
            type: 'text'
          });

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
      <header className={cn("px-4 py-3 flex items-center gap-3 backdrop-blur-md z-50 shadow-sm transition-colors duration-300 flex-shrink-0 sticky top-0", selectedMessageId ? "bg-emerald-600 border-none" : "bg-white border-b border-slate-100")}>
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
                <div className="flex items-center">
                  {(() => {
                    const msg = messages.find(m => m.id === selectedMessageId);
                    if (!msg) return null;
                    const diffMinutes = (new Date().getTime() - new Date(msg.created_at).getTime()) / (1000 * 60);
                    if (diffMinutes < 15 && msg.type === 'text') {
                      return (
                        <button 
                          onClick={() => {
                            setEditingMessage(msg);
                            setNewMessage(msg.content);
                            setSelectedMessageId(null);
                          }} 
                          className="p-2 hover:bg-emerald-700 rounded-full transition-colors" 
                          title="Edit"
                        >
                          <Pencil size={20} />
                        </button>
                      );
                    }
                    return null;
                  })()}
                  <button onClick={() => { deleteMessage(selectedMessageId); setSelectedMessageId(null); }} className="p-2 hover:bg-emerald-700 rounded-full transition-colors" title="Delete">
                    <Trash2 size={20} />
                  </button>
                </div>
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
                    <Avatar 
                      className="w-10 h-10 group-active:scale-95 transition-transform cursor-pointer hover:ring-2 hover:ring-emerald-500/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (group?.avatar_url) setViewingMedia({ url: group.avatar_url, type: 'profile' });
                      }}
                    >
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
                  <SheetContent side="right" className="w-[85vw] sm:max-w-md p-0 border-none flex flex-col overflow-hidden">
                    <div className="h-full flex flex-col bg-slate-50">
                      {/* Fixed Photo Header */}
                      <div className="relative h-64 bg-emerald-500 flex-shrink-0 overflow-hidden">
                        <div 
                          className="absolute inset-0 flex items-center justify-center transition-all bg-emerald-500 cursor-pointer group/header"
                          onClick={() => groupAvatarInputRef.current?.click()}
                        >
                          {group?.avatar_url ? (
                            <img src={group.avatar_url} alt={group.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="text-white font-bold text-8xl opacity-20">
                              {group?.name.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/header:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 text-white shadow-lg">
                              <Camera size={24} className={isUploadingGroupAvatar ? "animate-spin" : ""} />
                            </div>
                            <span className="text-[10px] font-bold text-white uppercase tracking-widest bg-black/20 px-3 py-1 rounded-full backdrop-blur-sm">Change Photo</span>
                          </div>
                        </div>

                        <input
                          type="file"
                          ref={groupAvatarInputRef}
                          onChange={handleGroupAvatarUpload}
                          className="hidden"
                          accept="image/*"
                        />

                        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none">
                          <h3 className="text-2xl font-bold text-white leading-tight">{group?.name}</h3>
                          <p className="text-white/80 text-xs mt-1">Created {group && format(new Date(group.created_at), 'MMM d, yyyy')}</p>
                        </div>
                      </div>

                      {/* Scrollable Area */}
                      <div className="flex-1 overflow-y-auto min-h-0">
                        <div className="p-6 space-y-6 pb-24">
                          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100/60">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Edit Group Info</h4>
                                <Plus size={16} className="text-emerald-500 rotate-45" />
                              </div>
                              <form onSubmit={handleUpdateGroup} className="space-y-4">
                                <Input
                                  placeholder="Group Name"
                                  value={editGroupName}
                                  onChange={(e) => setEditGroupName(e.target.value)}
                                  className="bg-slate-50 border border-slate-200/60 rounded-xl h-11 text-sm focus-visible:ring-emerald-500/20 transition-all font-medium"
                                />
                                <Input
                                  placeholder="Group Description (Optional)"
                                  value={editGroupDesc}
                                  onChange={(e) => setEditGroupDesc(e.target.value)}
                                  className="bg-slate-50 border border-slate-200/60 rounded-xl h-11 text-sm focus-visible:ring-emerald-500/20 transition-all font-medium"
                                />
                                <Button 
                                  type="submit" 
                                  disabled={isUpdatingGroup}
                                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-11 text-sm font-bold shadow-lg shadow-emerald-500/10 transition-all active:scale-[0.98]"
                                >
                                  {isUpdatingGroup ? "Updating..." : "Save Changes"}
                                </Button>
                              </form>
                            </div>
                          

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
                              className="bg-slate-50 border border-slate-200/60 rounded-xl h-10 text-sm placeholder:text-slate-400/70 placeholder:font-normal"
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
                          className="w-full text-slate-600 hover:text-slate-700 hover:bg-slate-50 rounded-2xl gap-2 h-12"
                        >
                          <LogOut size={20} /> Exit Group
                        </Button>
                        </div>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>

                {!isSearching && (
                  <div className="flex items-center gap-4 text-slate-600">
                    <button onClick={() => setIsSearching(true)} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
                      <Search size={20} />
                    </button>
                    <button 
                      onClick={handleSubscribe} 
                      className={cn(
                        "p-1 hover:bg-slate-100 rounded-full transition-colors relative group/bell",
                        notificationPermission === 'granted' ? "text-emerald-500" : "text-slate-400"
                      )}
                      title={notificationPermission === 'granted' ? "Notifications Enabled" : "Enable Notifications"}
                      disabled={isSubscribing}
                    >
                      {isSubscribing ? (
                        <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      ) : notificationPermission === 'granted' ? (
                        <Bell size={20} fill="currentColor" className="group-hover/bell:scale-110 transition-transform" />
                      ) : (
                        <BellOff size={20} className="group-hover/bell:scale-110 transition-transform" />
                      )}
                      {notificationPermission === 'default' && (
                        <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-white animate-pulse" />
                      )}
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
      <div className="flex-1 px-4 pt-4 pb-6 overflow-y-auto touch-pan-y relative message-area-scroll">
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
              const isNewSender = index === 0 || filteredMessages[index - 1].sender_id !== msg.sender_id;
              const showAvatar = isNewSender && !isMe;
              const showName = isNewSender;

              const isSystemMessage = msg.type === 'system' || msg.content?.startsWith('[SYSTEM]:');
              
              if (isSystemMessage) {
                const displayContent = msg.content.replace('[SYSTEM]: ', '').replace('[SYSTEM]:', '');
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex justify-center w-full my-6 px-4"
                  >
                    <div className="bg-slate-100/80 backdrop-blur-sm text-slate-500 text-[10px] sm:text-[11px] px-4 py-1.5 rounded-full font-bold uppercase tracking-widest shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-slate-200/50 text-center">
                      {displayContent.includes(currentUser?.username) 
                        ? displayContent.replace(currentUser.username, 'You') 
                        : displayContent}
                    </div>
                  </motion.div>
                );
              }

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.95, x: 0 }}
                  animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 100 }}
                  dragSnapToOrigin={true}
                  dragElastic={0.2}
                  onDragEnd={(_, info) => {
                    if (info.offset.x > 50) {
                      setReplyingTo(msg);
                    }
                  }}
                  className={cn(
                    "flex items-end gap-2 max-w-[85%] relative",
                    isMe ? "ml-auto flex-row-reverse" : "mr-auto",
                    group?.type === 'dm' && "gap-0" // No avatar gap in DM
                  )}
                >
                  {/* Reply Indicator Background */}
                  <div className="absolute -left-12 top-1/2 -translate-y-1/2 opacity-0 group-drag:opacity-100 transition-opacity">
                    <div className="bg-emerald-500 p-2 rounded-full text-white">
                      <Send size={16} />
                    </div>
                  </div>

                  {/* Avatar rendering for others (Groups ONLY) */}
                  {!isMe && group?.type === 'group' && (
                    <div className="w-8 h-8 flex-shrink-0">
                      {showAvatar && (
                        <Avatar 
                          className="w-8 h-8 ring-2 ring-white shadow-sm cursor-pointer hover:scale-110 transition-transform active:scale-95"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (msg.sender_avatar) setViewingMedia({ url: msg.sender_avatar, type: 'profile' });
                          }}
                        >
                          <AvatarImage src={msg.sender_avatar} />
                          <AvatarFallback className="bg-slate-200 text-[10px] font-bold">
                            {msg.sender_name?.substring(0, 2).toUpperCase() || 'M'}
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
                          ? "bg-[#E1EFFF] text-slate-900 rounded-br-none shadow-sm border border-blue-100/50"
                          : "bg-white text-slate-800 rounded-bl-none border border-slate-100",
                        selectedMessageId === msg.id && "ring-4 ring-emerald-500/30 scale-[0.98]",
                        !isNewSender && (isMe ? "mt-0.5" : "mt-0.5") // Tighter spacing for same-sender blocks
                      )}
                    >
                      {/* Show Name for Others (Groups ONLY) */}
                      {showName && !isMe && group?.type === 'group' && (
                        <p className="text-[10px] font-bold text-emerald-500 mb-1 uppercase tracking-tight">
                          {msg.sender_name || 'Member'}
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
                            setViewingMedia({ url: msg.file_url || '', type: 'image', id: msg.id });
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
                        <div 
                          className="mb-2 rounded-lg overflow-hidden border border-white/20 relative group cursor-pointer"
                          onClick={() => setViewingMedia({ url: msg.file_url || '', type: 'video', id: msg.id })}
                        >
                          <video src={msg.file_url} className="max-w-full h-auto" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-all">
                            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 text-white transform group-hover:scale-110 transition-transform">
                              <Video size={32} fill="currentColor" />
                            </div>
                          </div>
                        </div>
                      )}

                      {msg.type === 'audio' && msg.file_url && (
                        <div className="mb-2 p-3 bg-emerald-50/50 rounded-[2rem] border border-emerald-100 min-w-[240px] shadow-sm">
                          <div className="flex items-center gap-4">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                const audio = document.getElementById(`audio-${msg.id}`) as HTMLAudioElement;
                                if (audio.paused) audio.play();
                                else audio.pause();
                              }}
                              className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-md active:scale-90 transition-all hover:bg-emerald-600"
                            >
                              <div className="flex items-center justify-center">
                                {/* Simple CSS-based play/pause icon for performance */}
                                <div className="border-l-[12px] border-l-white border-y-[8px] border-y-transparent ml-1" />
                              </div>
                            </button>
                            <div className="flex-1 flex flex-col gap-2">
                              {/* Animated Waveform Mockup */}
                              <div className="flex items-end gap-[2px] h-6 px-1">
                                {[0.3, 0.5, 0.8, 0.4, 0.9, 0.6, 0.3, 0.7, 0.4, 0.8, 0.5, 0.3, 0.6].map((h, i) => (
                                  <div 
                                    key={i} 
                                    className="flex-1 bg-emerald-300 rounded-full" 
                                    style={{ height: `${h * 100}%` }} 
                                  />
                                ))}
                              </div>
                              <div className="flex justify-between text-[10px] text-emerald-600/60 font-bold uppercase tracking-wider">
                                <span>Voice Message</span>
                                <span>0:00</span>
                              </div>
                            </div>
                            <audio id={`audio-${msg.id}`} src={msg.file_url} className="hidden" />
                          </div>
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
                        isMe ? "text-slate-500" : "text-slate-400"
                      )}>
                        {starredMessageIds.includes(msg.id) && <Star size={10} fill="currentColor" className="text-yellow-400 mr-1" />}
                        <span suppressHydrationWarning>{format(new Date(msg.created_at), 'HH:mm')}</span>
                        <div className="flex items-center gap-1">
                          {msg.edited_at && <span className="text-[8px] text-slate-400 italic">Edited</span>}
                          {isMe && (
                            <div className="flex items-center ml-1">
                              {msg.read_by && msg.read_by.length >= (members.length - 1) ? (
                                <CheckCheck size={14} className="text-[#007AFF] drop-shadow-[0_0_4px_rgba(0,122,255,0.2)]" />
                              ) : msg.delivered_to && (Array.isArray(msg.delivered_to) && msg.delivered_to.length > 0) ? (
                                <CheckCheck size={14} className="text-slate-500/70" />
                              ) : (
                                <Check size={14} className="text-slate-500/70" />
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingReactionsMsg(msg);
                            setActiveReactionTab('All');
                            fetchReactionProfiles(msg);
                          }}
                          className={cn(
                            "absolute -bottom-3 flex gap-1 bg-white shadow-sm border border-slate-100 rounded-full px-1.5 py-0.5 z-20 hover:bg-slate-50 transition-colors cursor-pointer",
                            isMe ? "right-2" : "left-2"
                          )}
                        >
                          {Object.entries(msg.reactions).map(([emoji, users]) => (
                            <span key={emoji} className="text-[10px] flex items-center gap-0.5">
                              {emoji} <span className="text-[8px] text-slate-400">{(users as string[]).length}</span>
                            </span>
                          ))}
                        </button>
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
        <AnimatePresence mode="wait">
          {replyingTo && (
            <motion.div
              key="reply-bar"
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
          {editingMessage && (
            <motion.div
              key="edit-bar"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-2 bg-emerald-50 rounded-2xl p-3 flex items-center gap-3 border-l-4 border-emerald-500"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-emerald-600">Editing Message</p>
                <p className="text-sm text-slate-500 truncate">{editingMessage.content}</p>
              </div>
              <button 
                onClick={() => { 
                  setEditingMessage(null); 
                  setNewMessage(''); 
                }} 
                className="p-1 hover:bg-emerald-100 rounded-full"
              >
                <X size={16} className="text-emerald-400" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          {isRecordingAudio ? (
            <div className="flex-1 flex items-center justify-between bg-emerald-50 rounded-full px-6 py-3 border border-emerald-100">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm font-bold text-emerald-700">{formatTime(audioTime)}</span>
              </div>
              <motion.div 
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="text-xs text-emerald-600 font-medium flex items-center gap-2"
              >
                <span>Slide left to cancel</span>
                <ChevronRight size={14} className="rotate-180 opacity-50" />
              </motion.div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1">
                <div className="relative" id="emoji-picker-container">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    className={cn(
                      "text-slate-400 hover:text-emerald-500 rounded-full transition-colors",
                      isEmojiPickerOpen && "text-emerald-500 bg-emerald-50"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEmojiPickerOpen(!isEmojiPickerOpen);
                    }}
                  >
                    <Smile size={24} />
                  </Button>

                  <AnimatePresence>
                    {isEmojiPickerOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute bottom-full left-0 mb-4 w-72 bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-50 p-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="grid grid-cols-6 gap-2 max-h-60 overflow-y-auto no-scrollbar pb-2">
                          {['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'].map(emoji => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => {
                                setNewMessage(prev => prev + emoji);
                              }}
                              className="text-2xl hover:bg-slate-50 p-1 rounded-xl transition-all active:scale-90"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
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
                  onClick={() => setIsCameraOpen(true)}
                >
                  <Camera size={24} />
                </Button>
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
                  onFocus={() => setIsEmojiPickerOpen(false)}
                  placeholder="Type a message..."
                  className="bg-slate-100 border-none rounded-full px-6 py-6 focus-visible:ring-2 focus-visible:ring-emerald-500/20 transition-all placeholder:text-slate-400 placeholder:font-normal"
                />
              </div>
            </>
          )}

          <motion.div whileTap={{ scale: 0.9 }}>
            {newMessage.trim() ? (
              <Button
                type="submit"
                size="icon"
                className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full w-12 h-12 shadow-lg shadow-emerald-200"
              >
                {editingMessage ? <Check className="w-6 h-6" /> : <Send size={20} />}
              </Button>
            ) : (
              <Button
                type="button"
                onMouseDown={(e) => startAudioRecording(e)}
                onMouseUp={() => stopAudioRecording(false)}
                onMouseMove={(e) => handleAudioPointerMove(e)}
                onTouchStart={(e) => startAudioRecording(e)}
                onTouchEnd={() => stopAudioRecording(false)}
                onTouchMove={(e) => handleAudioPointerMove(e)}
                size="icon"
                className={cn(
                  "bg-emerald-500 hover:bg-emerald-600 text-white rounded-full w-12 h-12 shadow-lg shadow-emerald-200 transition-all touch-none select-none",
                  isRecordingAudio && "scale-150 ring-8 ring-emerald-500/20"
                )}
              >
                <Mic size={20} className={isRecordingAudio ? "animate-pulse" : ""} />
              </Button>
            )}
          </motion.div>
        </form>
      </div>

      {/* Background Pattern Overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />

      {/* Media Gallery Dialog */}
      <Dialog open={isViewingAllMedia} onOpenChange={setIsViewingAllMedia}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[600px] h-[80vh] rounded-3xl shadow-none flex flex-col p-8 overflow-hidden mx-auto">
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
        <DialogContent className="shadow-none border-none">
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

      {/* Advanced Media Viewer (Lightbox) */}
      <AnimatePresence>
        {viewingMedia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center"
          >
            {/* Header Controls */}
            <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent z-50">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setViewingMedia(null)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
                >
                  <ArrowLeft size={24} />
                </button>
                <div className="text-white">
                  <p className="font-bold text-sm">
                    {viewingMedia.type === 'profile' ? (group?.name || 'Profile') : 
                     viewingMedia.type === 'video' ? 'Video' : 'Photo'}
                  </p>
                  {viewingMedia.type !== 'profile' && viewingMedia.id && (
                    <p className="text-[10px] text-white/60">
                      {messages.find(m => m.id === viewingMedia.id)?.sender_name || 'Shared Media'}
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
                  layoutId={viewingMedia.type === 'profile' ? `avatar-${groupId}` : `img-${viewingMedia.id}`}
                  src={viewingMedia.url}
                  className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain z-10"
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
                    className="max-w-full max-h-[80vh] rounded-xl shadow-2xl "
                  />
                </motion.div>
              )}
            </motion.div>
            
            <div className="absolute bottom-8 left-0 right-0 flex justify-center text-white/40 text-[10px] uppercase tracking-widest font-bold">
              Swipe up or down to close
            </div>
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
                        onClick={() => { setViewingMedia({ url: m.file_url || '', type: 'image', id: m.id }); setIsViewingStarred(false); }}
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
      
      {/* Reaction Summary Sheet */}
      <Sheet open={!!viewingReactionsMsg} onOpenChange={(open) => !open && setViewingReactionsMsg(null)}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-[2.5rem] bg-white border-none p-0 flex flex-col shadow-2xl z-[150]">
          <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto my-4 shrink-0" />
          
          <SheetHeader className="px-6 pb-2 text-left shrink-0">
            <SheetTitle className="text-xl font-bold text-slate-800">Reactions</SheetTitle>
            <SheetDescription className="hidden">View who reacted to this message</SheetDescription>
          </SheetHeader>

          {viewingReactionsMsg?.reactions && (
            <>
              {/* Custom Tabs List */}
              <div className="px-6 border-b border-slate-100 shrink-0">
                <div className="flex gap-4 overflow-x-auto no-scrollbar py-2">
                  <button
                    onClick={() => setActiveReactionTab('All')}
                    className={cn(
                      "pb-2 px-1 text-sm font-semibold transition-all relative",
                      activeReactionTab === 'All' ? "text-emerald-500" : "text-slate-400"
                    )}
                  >
                    All
                    {activeReactionTab === 'All' && (
                      <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-full" />
                    )}
                  </button>
                  {Object.entries(viewingReactionsMsg.reactions).map(([emoji, users]) => (
                    <button
                      key={emoji}
                      onClick={() => setActiveReactionTab(emoji)}
                      className={cn(
                        "pb-2 px-1 text-sm transition-all relative flex items-center gap-1.5",
                        activeReactionTab === emoji ? "text-emerald-500 font-semibold" : "text-slate-400"
                      )}
                    >
                      <span>{emoji}</span>
                      <span className="text-xs opacity-60">{(users as string[]).length}</span>
                      {activeReactionTab === emoji && (
                        <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-full" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Users List */}
              <ScrollArea className="flex-1 px-4 py-2">
                {isFetchingReactions ? (
                  <div className="p-8 space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="flex gap-3 animate-pulse">
                        <div className="w-12 h-12 bg-slate-100 rounded-full" />
                        <div className="space-y-2 flex-1 pt-2">
                          <div className="h-4 bg-slate-100 rounded-full w-1/3" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {(() => {
                      if (!viewingReactionsMsg?.reactions) return null;
                      
                      const allUserIds = activeReactionTab === 'All' 
                        ? Array.from(new Set(Object.values(viewingReactionsMsg.reactions).flat() as string[]))
                        : (viewingReactionsMsg.reactions[activeReactionTab] as string[] || []);

                      return allUserIds.map(userId => {
                        const profile = reactionProfiles[userId];
                        // Find which emoji this specific user used
                        const userEmoji = Object.entries(viewingReactionsMsg.reactions!).find(([_, ids]) => (ids as string[]).includes(userId))?.[0];

                        return (
                          <div key={`${userId}-${activeReactionTab}`} className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-2xl transition-colors">
                            <div className="relative">
                              <Avatar className="w-12 h-12 border-2 border-white shadow-sm">
                                <AvatarImage src={profile?.avatar_url} />
                                <AvatarFallback className="bg-slate-100 text-slate-400 text-xs font-bold uppercase">
                                  {profile?.username?.substring(0, 2).toUpperCase() || '??'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-sm border border-slate-50 text-xs leading-none">
                                {userEmoji}
                              </div>
                            </div>
                            <div className="flex-1">
                              <p className="font-bold text-slate-700">{profile?.username || 'Unknown User'}</p>
                              <p className="text-[10px] text-slate-400">Tapped to react</p>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Camera Capture Overlay */}
      <AnimatePresence>
        {isCameraOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center p-0 m-0"
          >
            <div className="absolute top-6 left-6 z-[210]">
              <button 
                onClick={() => setIsCameraOpen(false)}
                className="p-3 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
              <video 
                ref={videoRef}
                autoPlay 
                playsInline 
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
              
              <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center justify-center gap-6 z-[210]">
                {isRecording ? (
                  <div className="bg-red-500/90 backdrop-blur-md px-6 py-2 rounded-full text-white text-sm font-bold flex items-center gap-2 animate-pulse mb-4">
                    <div className="w-2 h-2 bg-white rounded-full" />
                    {formatTime(recordingTime)}
                  </div>
                ) : (
                  <div className="bg-black/40 backdrop-blur-sm px-4 py-2 rounded-full text-white/80 text-xs font-medium uppercase tracking-[0.2em] mb-4">
                    Tap for Photo • Hold for Video
                  </div>
                )}
                
                <div className="flex items-center gap-12">
                  <button
                    onClick={switchCamera}
                    disabled={isRecording}
                    className="p-4 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-all active:scale-90 disabled:opacity-0"
                  >
                    <RefreshCw size={28} />
                  </button>

                  <button
                    onMouseDown={handleStartRecording}
                    onMouseUp={handleStopRecording}
                    onTouchStart={handleStartRecording}
                    onTouchEnd={handleStopRecording}
                    onClick={() => {
                      if (!isRecording) capturePhoto();
                    }}
                    className={cn(
                      "w-20 h-20 bg-white rounded-full border-4 border-white/50 flex items-center justify-center transition-all shadow-2xl relative",
                      isRecording ? "scale-125 border-red-500/50" : "active:scale-90"
                    )}
                  >
                    <div className={cn(
                      "transition-all",
                      isRecording ? "w-8 h-8 bg-red-500 rounded-lg" : "w-16 h-16 bg-white border-2 border-slate-900/10 rounded-full"
                    )} />
                  </button>

                  <div className="p-10" /> {/* Spacer */}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
