"use client";

import React from "react";
import { SubScreenHeader } from "../SettingsNavigator";
import { useSettings } from "../SettingsContext";
import { ChevronRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export function ChatsScreen({ onBack }: { onBack: () => void }) {
  const { settings, updateSetting } = useSettings();

  const OptionItem = ({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) => (
    <div 
      onClick={onClick}
      className={`flex items-center justify-between p-4 bg-white border-b border-slate-50 last:border-none ${onClick ? 'cursor-pointer hover:bg-slate-50 active:bg-slate-100 transition-colors' : ''}`}
    >
      <span className="text-slate-900 font-medium">{label}</span>
      <div className="flex items-center gap-2 text-slate-500">
        <span className="text-sm capitalize">{value}</span>
        {onClick && <ChevronRight size={18} />}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto touch-pan-y">
      <SubScreenHeader title="Chats" onBack={onBack} />
      
      <div className="mt-2 space-y-4 pb-20">
        {/* Display */}
        <div>
          <p className="px-4 py-2 text-sm font-semibold text-emerald-600">Display</p>
          <div className="bg-white border-y border-slate-100">
            <OptionItem 
              label="Theme" 
              value={settings.chat_theme}
              onClick={() => {
                const next = settings.chat_theme === 'system' ? 'light' : settings.chat_theme === 'light' ? 'dark' : 'system';
                updateSetting("chat_theme", next as any);
              }}
            />
            <OptionItem 
              label="Wallpaper" 
              value=""
              onClick={() => {}}
            />
          </div>
        </div>

        {/* Chat settings */}
        <div>
          <p className="px-4 py-2 text-sm font-semibold text-emerald-600">Chat settings</p>
          <div className="bg-white border-y border-slate-100">
            <div className="flex items-center justify-between p-4 border-b border-slate-50">
              <div>
                <h3 className="font-medium text-slate-900">Enter is send</h3>
                <p className="text-sm text-slate-500 mt-1">Enter key will send your message</p>
              </div>
              <Switch 
                checked={settings.chat_enter_is_send} 
                onCheckedChange={(c) => updateSetting("chat_enter_is_send", c)} 
                className="data-[state=checked]:bg-emerald-500"
              />
            </div>
            
            <div className="flex items-center justify-between p-4 border-b border-slate-50">
              <div>
                <h3 className="font-medium text-slate-900">Media visibility</h3>
                <p className="text-sm text-slate-500 mt-1">Show newly downloaded media in your device's gallery</p>
              </div>
              <Switch 
                checked={settings.chat_media_visibility} 
                onCheckedChange={(c) => updateSetting("chat_media_visibility", c)} 
                className="data-[state=checked]:bg-emerald-500"
              />
            </div>

            <OptionItem 
              label="Font size" 
              value={settings.chat_font_size}
              onClick={() => {
                const next = settings.chat_font_size === 'medium' ? 'large' : settings.chat_font_size === 'large' ? 'small' : 'medium';
                updateSetting("chat_font_size", next as any);
              }}
            />
          </div>
        </div>

        {/* Archived, Backup, History */}
        <div className="bg-white border-y border-slate-100">
          <div className="flex items-center justify-between p-4 border-b border-slate-50">
            <div>
              <h3 className="font-medium text-slate-900">Keep chats archived</h3>
              <p className="text-sm text-slate-500 mt-1">Archived chats will remain archived when you receive a new message</p>
            </div>
            <Switch checked={true} onCheckedChange={() => {}} className="data-[state=checked]:bg-emerald-500"/>
          </div>
        </div>

        <div className="bg-white border-y border-slate-100">
          <OptionItem label="Chat backup" value="" onClick={() => {}} />
          <OptionItem label="Transfer chats" value="" onClick={() => {}} />
          <OptionItem label="Chat history" value="" onClick={() => {}} />
        </div>
      </div>
    </div>
  );
}
