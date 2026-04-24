"use client";

import React, { useState, useEffect, useRef, ChangeEvent } from "react";
import { SubScreenHeader } from "../SettingsNavigator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, User, Info, Smartphone } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function ProfileScreen({ onBack }: { onBack: () => void }) {
  const [profile, setProfile] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadData() {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      if (currentUser) {
        if (localStorage.getItem("mock_session")) {
          setProfile({ username: "Ashish", status: "Hey there! I am using WhatsApp Pro." });
        } else {
          const { data } = await supabase.from("profiles").select("*").eq("id", currentUser.id).single();
          setProfile(data);
        }
      }
    }
    loadData();
  }, []);

  async function handleAvatarUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage.from("chat-media").upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("chat-media").getPublicUrl(filePath);

      const { error: updateError } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id);
      if (updateError) throw updateError;

      setProfile((prev: any) => ({ ...prev, avatar_url: publicUrl }));
      toast.success("Profile picture updated!");
    } catch (err: any) {
      if (localStorage.getItem("mock_session")) {
        const localUrl = URL.createObjectURL(file);
        setProfile((prev: any) => ({ ...prev, avatar_url: localUrl }));
        toast.info("Dev Mode: Avatar updated locally");
      } else {
        toast.error(`Error uploading avatar: ${err.message}`);
      }
    } finally {
      setIsUploading(false);
    }
  }

  const [isEditNameOpen, setIsEditNameOpen] = useState(false);
  const [isEditStatusOpen, setIsEditStatusOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftStatus, setDraftStatus] = useState("");

  const saveName = async () => {
    if (!draftName || draftName === profile?.username) {
      setIsEditNameOpen(false);
      return;
    }

    if (localStorage.getItem("mock_session")) {
      setProfile((p: any) => ({ ...p, username: draftName }));
      setIsEditNameOpen(false);
      return;
    }

    const { error } = await supabase.from("profiles").update({ username: draftName }).eq("id", user.id);
    if (!error) {
      setProfile((p: any) => ({ ...p, username: draftName }));
      toast.success("Name updated");
    }
    setIsEditNameOpen(false);
  }

  const saveStatus = async () => {
    if (!draftStatus || draftStatus === profile?.status) {
      setIsEditStatusOpen(false);
      return;
    }

    if (localStorage.getItem("mock_session")) {
      setProfile((p: any) => ({ ...p, status: draftStatus }));
      setIsEditStatusOpen(false);
      return;
    }

    const { error } = await supabase.from("profiles").update({ status: draftStatus }).eq("id", user.id);
    if (!error) {
      setProfile((p: any) => ({ ...p, status: draftStatus }));
      toast.success("Status updated");
    }
    setIsEditStatusOpen(false);
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto touch-pan-y">
      <SubScreenHeader title="Profile" onBack={onBack} />
      
      <div className="flex flex-col items-center py-8">
        <div className="relative">
          <Avatar className="w-36 h-36 border-4 border-white shadow-xl shadow-slate-200">
            <AvatarImage src={profile?.avatar_url} />
            <AvatarFallback className="bg-emerald-100 text-emerald-700 text-4xl font-bold">
              {profile?.username?.substring(0, 2).toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} className="hidden" accept="image/*" />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="absolute bottom-1 right-1 p-3 bg-emerald-500 text-white rounded-full shadow-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
          >
            <Camera size={20} className={isUploading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <div className="bg-white border-y border-slate-100">
        <div 
          className="flex items-start gap-4 p-4 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors" 
          onClick={() => {
            setDraftName(profile?.username || "");
            setIsEditNameOpen(true);
          }}
        >
          <User className="text-slate-400 mt-1" size={24} />
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-500">Name</p>
            <p className="text-base text-slate-900 mt-0.5">{profile?.username || "Loading..."}</p>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              This is not your username or pin. This name will be visible to your WhatsApp contacts.
            </p>
          </div>
        </div>

        <div 
          className="flex items-start gap-4 p-4 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors" 
          onClick={() => {
            setDraftStatus(profile?.status || "");
            setIsEditStatusOpen(true);
          }}
        >
          <Info className="text-slate-400 mt-1" size={24} />
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-500">About</p>
            <p className="text-base text-slate-900 mt-0.5">{profile?.status || "Loading..."}</p>
          </div>
        </div>

        <div className="flex items-start gap-4 p-4 hover:bg-slate-50 transition-colors">
          <Smartphone className="text-slate-400 mt-1" size={24} />
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-500">Phone</p>
            <p className="text-base text-slate-900 mt-0.5">{user?.email || "No email linked"}</p>
          </div>
        </div>
      </div>

      <Dialog open={isEditNameOpen} onOpenChange={setIsEditNameOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] w-full rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle>Enter your name</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input 
              value={draftName} 
              onChange={(e) => setDraftName(e.target.value)} 
              className="border-b-2 border-0 border-emerald-500 rounded-none px-0 focus-visible:ring-0 text-base"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-4 mt-2">
            <Button variant="ghost" onClick={() => setIsEditNameOpen(false)} className="text-slate-500">Cancel</Button>
            <Button onClick={saveName} className="bg-emerald-500 hover:bg-emerald-600">Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditStatusOpen} onOpenChange={setIsEditStatusOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] w-full rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle>Enter your about status</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input 
              value={draftStatus} 
              onChange={(e) => setDraftStatus(e.target.value)} 
              className="border-b-2 border-0 border-emerald-500 rounded-none px-0 focus-visible:ring-0 text-base"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-4 mt-2">
            <Button variant="ghost" onClick={() => setIsEditStatusOpen(false)} className="text-slate-500">Cancel</Button>
            <Button onClick={saveStatus} className="bg-emerald-500 hover:bg-emerald-600">Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
