"use client";

import React, { useRef, useState } from "react";
import { SubScreenHeader } from "../SettingsNavigator";
import { useSettings } from "../SettingsContext";
import { ChevronRight, Shield, ShieldCheck, Smartphone, Trash2, Camera } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

const OptionItem = ({ label, icon: Icon, onClick, textRed }: any) => (
  <div 
    onClick={onClick}
    className={`flex items-center gap-4 p-4 bg-white border-b border-slate-50 last:border-none cursor-pointer hover:bg-slate-50 active:bg-slate-100 transition-colors ${textRed ? 'text-red-500' : 'text-slate-900'}`}
  >
    {Icon && <Icon size={22} className={textRed ? 'text-red-500' : 'text-slate-500'} />}
    <span className="font-medium flex-1">{label}</span>
  </div>
);

export function AccountScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto touch-pan-y">
      <SubScreenHeader title="Account" onBack={onBack} />
      <div className="mt-2 bg-white border-y border-slate-100">
        <OptionItem icon={ShieldCheck} label="Security notifications" onClick={() => toast.info("Coming soon")} />
        <OptionItem icon={Shield} label="Two-step verification" onClick={() => toast.info("Coming soon")} />
        <OptionItem icon={Smartphone} label="Change number" onClick={() => toast.info("Coming soon")} />
        <OptionItem icon={Trash2} label="Delete my account" textRed onClick={() => toast.info("Coming soon")} />
      </div>
    </div>
  );
}

export function NotificationsScreen({ onBack }: { onBack: () => void }) {
  const { settings, updateSetting } = useSettings();
  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto touch-pan-y">
      <SubScreenHeader title="Notifications" onBack={onBack} />
      <div className="mt-2 space-y-4 pb-20">
        <div>
          <p className="px-4 py-2 text-sm font-semibold text-emerald-600">Messages</p>
          <div className="bg-white border-y border-slate-100 p-4 flex items-center justify-between">
            <div>
              <h3 className="font-medium text-slate-900">High priority notifications</h3>
              <p className="text-sm text-slate-500">Show previews of notifications at the top of the screen</p>
            </div>
            <Switch 
              checked={settings.notify_high_priority} 
              onCheckedChange={(c) => updateSetting("notify_high_priority", c)} 
              className="data-[state=checked]:bg-emerald-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function StorageDataScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto touch-pan-y">
      <SubScreenHeader title="Storage and Data" onBack={onBack} />
      <div className="mt-2 space-y-4 pb-20">
        <div className="bg-white border-y border-slate-100 p-4">
          <h3 className="font-medium text-slate-900">Network usage</h3>
          <p className="text-sm text-slate-500 mt-1">2.4 GB sent • 4.1 GB received</p>
        </div>
        <div>
          <p className="px-4 py-2 text-sm font-semibold text-emerald-600">Media auto-download</p>
          <div className="bg-white border-y border-slate-100">
            <OptionItem label="When using mobile data" onClick={() => {}} />
            <OptionItem label="When connected on Wi-Fi" onClick={() => {}} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function HelpScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto touch-pan-y">
      <SubScreenHeader title="Help" onBack={onBack} />
      <div className="mt-2 bg-white border-y border-slate-100">
        <OptionItem label="Help Center" onClick={() => {}} />
        <OptionItem label="Contact us" onClick={() => {}} />
        <OptionItem label="Terms and Privacy Policy" onClick={() => {}} />
        <OptionItem label="App info" onClick={() => {}} />
      </div>
    </div>
  );
}
