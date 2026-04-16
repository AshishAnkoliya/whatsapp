"use client";

import { useState, useEffect, useRef, FormEvent, ChangeEvent } from 'react';
import { User, Bell, Lock, Shield, HelpCircle, LogOut, ChevronRight, Moon, Globe, Camera } from 'lucide-react';
import { motion } from 'motion/react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import { toast } from 'sonner';

export default function Settings() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    const user = await getCurrentUser();
    setUser(user);

    if (user) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      setProfile(data);
      setEditName(data?.username || '');
      setEditStatus(data?.status || '');
    }
  }

  async function handleUpdateProfile(e: FormEvent) {
    e.preventDefault();
    if (!user) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          username: editName,
          status: editStatus,
        })
        .eq('id', user.id);

      if (error) {
        if (localStorage.getItem('mock_session')) {
          setProfile({ ...profile, username: editName, status: editStatus });
          setIsEditing(false);
          toast.success('Profile updated locally (Dev Mode)');
          return;
        }
        throw error;
      }
      
      setProfile({ ...profile, username: editName, status: editStatus });
      setIsEditing(false);
      toast.success('Profile updated!');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleAvatarUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to 'chat-media' bucket (using existing bucket for simplicity)
      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, file);

      if (uploadError) {
        if (uploadError.message.includes('Bucket not found') || uploadError.message.includes('row-level security policy')) {
          const localUrl = URL.createObjectURL(file);
          setProfile({ ...profile, avatar_url: localUrl });
          toast.info('Dev Mode: Using local preview (RLS Policy or Bucket issue)');
          return;
        }
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) {
        if (localStorage.getItem('mock_session') || updateError.message.includes('row-level security policy')) {
          setProfile({ ...profile, username: editName, status: editStatus });
          setIsEditing(false);
          toast.success('Profile updated locally (Dev Mode/RLS)');
          return;
        }
        throw updateError;
      }

      setProfile({ ...profile, avatar_url: publicUrl });
      toast.success('Profile picture updated!');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleLogout() {
    localStorage.removeItem('mock_session');
    await supabase.auth.signOut();
    window.location.href = '/'; // Redirect to login
  }

  const handleItemClick = (label: string) => {
    toast.info(`${label} settings coming soon!`);
  };

  const settingsItems = [
    { icon: User, label: 'Account', sub: 'Privacy, security, change number', color: 'bg-blue-100 text-blue-600' },
    { icon: Lock, label: 'Privacy', sub: 'Last seen, profile photo, groups', color: 'bg-emerald-100 text-emerald-600' },
    { icon: Bell, label: 'Notifications', sub: 'Message, group & call tones', color: 'bg-orange-100 text-orange-600' },
    { icon: Shield, label: 'Security', sub: 'Two-step verification, encryption', color: 'bg-indigo-100 text-indigo-600' },
    { icon: Globe, label: 'App Language', sub: 'English (device language)', color: 'bg-purple-100 text-purple-600' },
    { icon: HelpCircle, label: 'Help', sub: 'Help center, contact us, privacy policy', color: 'bg-slate-100 text-slate-600' },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <header className="px-4 py-6 bg-white border-b border-slate-100 sticky top-0 z-40">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
      </header>

      <div className="flex-1 overflow-y-auto touch-pan-y">
        <div className="p-4 space-y-6 pb-10">
          {/* Dev Mode Banner */}
          {localStorage.getItem('mock_session') && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 bg-amber-50 border border-amber-100 rounded-3xl mb-4"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-100 rounded-xl text-amber-600">
                  <Shield size={20} />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-amber-900">You are in Dev Mode</h3>
                  <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                    This is a local preview. Data is not saved permanently. 
                    To test real chat and save data, please log out and use a real account.
                  </p>
                  <button 
                    onClick={handleLogout}
                    className="mt-3 text-xs font-bold text-amber-900 underline underline-offset-4 hover:text-amber-800"
                  >
                    Switch to Live Mode
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Profile Section */}
          <Dialog open={isEditing} onOpenChange={setIsEditing}>
            <div className="relative group mx-auto w-fit">
              <Avatar className="w-28 h-28 border-4 border-white shadow-xl">
                <AvatarImage src={profile?.avatar_url} />
                <AvatarFallback className="bg-emerald-100 text-emerald-700 text-3xl font-bold">
                  {profile?.username?.substring(0, 2).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleAvatarUpload} 
                className="hidden" 
                accept="image/*"
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="absolute bottom-0 right-0 p-2 bg-emerald-500 text-white rounded-full shadow-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
              >
                <Camera size={20} className={isUploading ? "animate-spin" : ""} />
              </button>
            </div>

            <DialogTrigger
              render={
                <motion.button 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full flex items-center gap-4 p-4 bg-white rounded-3xl shadow-sm border border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors mt-4 text-left"
                />
              }
            >
              <div className="flex-1">
                <h2 className="text-xl font-bold text-slate-900">{profile?.username || 'User'}</h2>
                <p className="text-sm text-slate-500 line-clamp-1">{profile?.status || 'Hey there! I am using WhatsApp Pro.'}</p>
              </div>
              <div className="p-2 rounded-full text-emerald-600">
                <ChevronRight size={24} />
              </div>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] rounded-3xl border-none shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">Edit Profile</DialogTitle>
                <DialogDescription>
                  Update your public information.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleUpdateProfile} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Username</Label>
                  <Input
                    id="name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="bg-slate-50 border-none rounded-xl h-12 focus-visible:ring-emerald-500/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status" className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Status</Label>
                  <Input
                    id="status"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="bg-slate-50 border-none rounded-xl h-12 focus-visible:ring-emerald-500/20"
                  />
                </div>
                <DialogFooter className="pt-4">
                  <Button 
                    type="submit" 
                    className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-100 transition-all active:scale-[0.98]"
                    disabled={isUpdating}
                  >
                    {isUpdating ? 'Updating...' : 'Save Changes'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Settings List */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden mb-6">
            {settingsItems.map((item, index) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleItemClick(item.label)}
                className="flex items-center gap-4 p-4 hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-50 last:border-none active:bg-slate-100"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.color}`}>
                  <item.icon size={20} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900">{item.label}</h3>
                  <p className="text-xs text-slate-400">{item.sub}</p>
                </div>
                <ChevronRight size={18} className="text-slate-300" />
              </motion.div>
            ))}
          </div>

          {/* Logout Section */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleLogout}
              className="w-full flex items-center gap-4 p-4 text-red-600 hover:bg-red-50 transition-colors font-bold"
            >
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <LogOut size={20} />
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-bold">Log Out</h3>
                <p className="text-[10px] text-red-400 uppercase tracking-wider">Sign out of your account</p>
              </div>
              <ChevronRight size={18} className="text-red-200" />
            </motion.button>
          </div>

          <div className="text-center py-10 space-y-1">
            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">from</p>
            <p className="text-sm font-black text-emerald-500 tracking-tighter">META-LIKE STUDIO</p>
          </div>
        </div>
      </div>
    </div>
  );
}
