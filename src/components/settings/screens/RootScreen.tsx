"use client";

import React, { useEffect, useState } from "react";
import { User, Bell, Lock, ShieldCheck, HelpCircle, LogOut, ChevronRight, Globe, MessageSquare, Database } from "lucide-react";
import { motion } from "motion/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { ScreenName } from "../SettingsNavigator";

export function RootScreen({ onNavigate }: { onNavigate: (screen: ScreenName) => void }) {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    async function fetchProfile() {
      const user = await getCurrentUser();
      if (user) {
        if (localStorage.getItem("mock_session")) {
          // Dev mode
          setProfile({ username: "Ashish", status: "Hey there! I am using WhatsApp Pro." });
          return;
        }
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        setProfile(data);
      }
    }
    fetchProfile();
  }, []);

  const handleLogout = async () => {
    localStorage.removeItem("mock_session");
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const settingsItems: { icon: any; label: string; sub: string; color: string; screen: ScreenName }[] = [
    { icon: User, label: "Account", sub: "Security notifications, change number", color: "bg-blue-100 text-blue-600", screen: "account" },
    { icon: Lock, label: "Privacy", sub: "Block contacts, disappearing messages", color: "bg-emerald-100 text-emerald-600", screen: "privacy" },
    { icon: MessageSquare, label: "Chats", sub: "Theme, wallpapers, chat history", color: "bg-green-100 text-green-600", screen: "chats" },
    { icon: Bell, label: "Notifications", sub: "Message, group & call tones", color: "bg-orange-100 text-orange-600", screen: "notifications" },
    { icon: Database, label: "Storage and Data", sub: "Network usage, auto-download", color: "bg-indigo-100 text-indigo-600", screen: "storage" },
    { icon: Globe, label: "App Language", sub: "English (device's language)", color: "bg-pink-100 text-pink-600", screen: "root" },
    { icon: HelpCircle, label: "Help", sub: "Help center, contact us, privacy policy", color: "bg-slate-100 text-slate-600", screen: "help" },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto touch-pan-y">
      <header className="px-4 py-4 bg-white border-b border-slate-100 sticky top-0 z-40 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Settings</h1>
      </header>

      <div className="p-4 space-y-4 pb-20">
        {/* Profile Card */}
        <motion.div 
          onClick={() => onNavigate("profile")}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-4 p-4 bg-white rounded-2xl shadow-sm border border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors"
        >
          <Avatar className="w-16 h-16 shadow-lg shadow-emerald-100">
            <AvatarImage src={profile?.avatar_url} />
            <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xl font-bold">
              {profile?.username?.substring(0, 2).toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-slate-900">{profile?.username || "User"}</h2>
            <p className="text-sm text-slate-500 line-clamp-1">{profile?.status || "Hey there! I am using WhatsApp Pro."}</p>
          </div>
          <ChevronRight size={24} className="text-emerald-500" />
        </motion.div>

        {/* Settings List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {settingsItems.map((item, index) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => {
                if (item.screen !== "root") onNavigate(item.screen);
              }}
              className="flex items-center gap-4 p-4 hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-50 last:border-none active:bg-slate-100"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${item.color}`}>
                <item.icon size={20} />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-slate-900">{item.label}</h3>
                <p className="text-xs text-slate-500">{item.sub}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Logout Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleLogout}
            className="w-full flex items-center gap-4 p-4 text-red-600 hover:bg-red-50 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <LogOut size={20} />
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-medium">Log Out</h3>
            </div>
          </motion.button>
        </div>

        <div className="text-center py-8 space-y-1">
          <p className="text-xs text-slate-400">from</p>
          <p className="text-sm font-semibold text-emerald-600 tracking-wide">META-LIKE STUDIO</p>
        </div>
      </div>
    </div>
  );
}
