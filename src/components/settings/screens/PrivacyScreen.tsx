"use client";

import React from "react";
import { SubScreenHeader } from "../SettingsNavigator";
import { useSettings } from "../SettingsContext";
import { ChevronRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export function PrivacyScreen({ onBack }: { onBack: () => void }) {
  const { settings, updateSetting } = useSettings();

  const handleReadReceiptsToggle = (checked: boolean) => {
    updateSetting("privacy_read_receipts", checked);
  };

  const OptionItem = ({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) => (
    <div 
      onClick={onClick}
      className={`flex items-center justify-between p-4 bg-white border-b border-slate-50 last:border-none ${onClick ? 'cursor-pointer hover:bg-slate-50 active:bg-slate-100 transition-colors' : ''}`}
    >
      <span className="text-slate-900 font-medium">{label}</span>
      <div className="flex items-center gap-2 text-slate-500">
        <span className="text-sm capitalize">{value.replace("_", " ")}</span>
        {onClick && <ChevronRight size={18} />}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto touch-pan-y">
      <SubScreenHeader title="Privacy" onBack={onBack} />
      
      <div className="mt-2 space-y-4 pb-20">
        {/* Who can see my personal info */}
        <div>
          <p className="px-4 py-2 text-sm font-semibold text-emerald-600">Who can see my personal info</p>
          <div className="bg-white border-y border-slate-100">
            <OptionItem 
              label="Last seen and online" 
              value={settings.privacy_last_seen}
              // In a real app we would push another sub-screen or open a modal to select the value
              onClick={() => {
                const next = settings.privacy_last_seen === 'everyone' ? 'my_contacts' : settings.privacy_last_seen === 'my_contacts' ? 'nobody' : 'everyone';
                updateSetting("privacy_last_seen", next as any);
              }}
            />
            <OptionItem 
              label="Profile photo" 
              value={settings.privacy_profile_photo}
              onClick={() => {
                const next = settings.privacy_profile_photo === 'everyone' ? 'my_contacts' : settings.privacy_profile_photo === 'my_contacts' ? 'nobody' : 'everyone';
                updateSetting("privacy_profile_photo", next as any);
              }}
            />
            <OptionItem 
              label="About" 
              value={settings.privacy_about}
              onClick={() => {
                const next = settings.privacy_about === 'everyone' ? 'my_contacts' : settings.privacy_about === 'my_contacts' ? 'nobody' : 'everyone';
                updateSetting("privacy_about", next as any);
              }}
            />
            <OptionItem 
              label="Status" 
              value={settings.privacy_status}
              onClick={() => {
                const next = settings.privacy_status === 'everyone' ? 'my_contacts' : settings.privacy_status === 'my_contacts' ? 'nobody' : 'everyone';
                updateSetting("privacy_status", next as any);
              }}
            />
          </div>
        </div>

        {/* Read Receipts */}
        <div className="bg-white border-y border-slate-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-slate-900">Read receipts</h3>
              <p className="text-sm text-slate-500 mt-1 leading-snug">
                If turned off, you won't send or receive read receipts. Read receipts are always sent for group chats.
              </p>
            </div>
            <Switch 
              checked={settings.privacy_read_receipts} 
              onCheckedChange={handleReadReceiptsToggle} 
              className="data-[state=checked]:bg-emerald-500"
            />
          </div>
        </div>

        {/* Other settings */}
        <div className="bg-white border-y border-slate-100">
          <OptionItem 
            label="Disappearing messages" 
            value="Off"
            onClick={() => {}}
          />
          <OptionItem 
            label="Groups" 
            value="Everyone"
            onClick={() => {}}
          />
          <OptionItem 
            label="Live location" 
            value="None"
            onClick={() => {}}
          />
          <OptionItem 
            label="Calls" 
            value="Silence unknown callers"
            onClick={() => {}}
          />
          <OptionItem 
            label="Blocked contacts" 
            value="None"
            onClick={() => {}}
          />
          <OptionItem 
            label="App lock" 
            value="Disabled"
            onClick={() => {}}
          />
        </div>
      </div>
    </div>
  );
}
