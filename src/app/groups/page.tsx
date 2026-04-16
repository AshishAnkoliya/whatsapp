"use client";

import * as React from 'react';
import { useState } from 'react';
import { Users, Search, Plus, MessageSquare } from 'lucide-react';
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
  const [isCreating, setIsCreating] = useState(false);

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
          created_by: user.id
        });

      if (groupError) throw groupError;

      toast.success('Community created successfully!');
      setNewGroupName('');
      setNewGroupDesc('');
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
            <DialogContent className="max-w-[90vw] sm:max-w-md rounded-[2.5rem] border border-white/50 bg-white/90 backdrop-blur-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] p-0 overflow-hidden ring-0">
              <DialogHeader className="pt-8 px-8 pb-4">
                <DialogTitle className="text-3xl font-black text-slate-900 tracking-tight">New Community</DialogTitle>
                <DialogDescription className="text-slate-500 font-medium">
                  Bring people together with a common interest.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateGroup} className="space-y-6 px-8 pb-10 pt-2">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Community Name</label>
                  <Input 
                    placeholder="e.g. Weekend Hikers" 
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="bg-slate-50/50 border-slate-200 rounded-2xl h-14 px-4 shadow-sm transition-all focus-visible:ring-emerald-500/10 focus-visible:border-emerald-500 focus-visible:bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Description (Optional)</label>
                  <Input 
                    placeholder="What's this community about?" 
                    value={newGroupDesc}
                    onChange={(e) => setNewGroupDesc(e.target.value)}
                    className="bg-slate-50/50 border-slate-200 rounded-2xl h-14 px-4 shadow-sm transition-all focus-visible:ring-emerald-500/10 focus-visible:border-emerald-500 focus-visible:bg-white"
                  />
                </div>
                <div className="pt-2">
                  <Button 
                    type="submit" 
                    className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold shadow-xl shadow-emerald-100 transition-all active:scale-[0.98] text-base"
                    disabled={isCreating}
                  >
                    {isCreating ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Creating...</span>
                      </div>
                    ) : 'Create Community'}
                  </Button>
                </div>
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
