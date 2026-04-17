"use client";

import * as React from 'react';
import { useState } from 'react';
import { Users, Search, Plus, MessageSquare, Camera, Upload, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import { toast } from 'sonner';

export default function Groups() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupAvatar, setNewGroupAvatar] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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
      toast.success('Community photo uploaded!');
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

      const { error: groupError } = await supabase
        .from('groups')
        .insert({
          name: newGroupName,
          description: newGroupDesc,
          avatar_url: newGroupAvatar,
          created_by: user.id
        });

      if (groupError) throw groupError;

      toast.success('Community created successfully!');
      setNewGroupName('');
      setNewGroupDesc('');
      setNewGroupAvatar(null);
      setIsCreateDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create community');
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <header className="px-4 py-6 bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-slate-900">Groups</h1>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger 
              render={
                <motion.button 
                  whileTap={{ scale: 0.9 }}
                  className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-100"
                >
                  <Plus size={20} />
                </motion.button>
              }
            />
            <DialogContent className="border-none shadow-none">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-center">New Community</DialogTitle>
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
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] ml-1">Community Name</label>
                  <Input 
                    placeholder="e.g. Weekend Hikers" 
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="bg-slate-50 border border-slate-200/60 rounded-xl h-12 focus-visible:ring-emerald-500/20 placeholder:text-slate-400/70 placeholder:font-normal"
                  />
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] ml-1">Description (Optional)</label>
                    <Input 
                      placeholder="What's this community about?" 
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
                    {isCreating ? 'Creating...' : 'Create Community'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input 
            placeholder="Search groups..." 
            className="pl-10 bg-slate-50 border-none rounded-xl h-11 focus-visible:ring-emerald-500/20"
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto touch-pan-y">
        <div className="flex flex-col items-center justify-center py-20 px-10 text-center">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mb-6"
          >
            <Users size={40} />
          </motion.div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">No Group Communities</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            Communities bring members together in topic-based groups. Any community you're added to will appear here.
          </p>
          <button 
            onClick={() => setIsCreateDialogOpen(true)}
            className="mt-8 text-emerald-600 font-bold text-sm hover:underline"
          >
            Start your community
          </button>
        </div>
      </div>
    </div>
  );
}
