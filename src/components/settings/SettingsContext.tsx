"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { toast } from "sonner";

export interface UserSettings {
  privacy_last_seen: "everyone" | "my_contacts" | "nobody";
  privacy_profile_photo: "everyone" | "my_contacts" | "nobody";
  privacy_about: "everyone" | "my_contacts" | "nobody";
  privacy_status: "everyone" | "my_contacts" | "nobody";
  privacy_read_receipts: boolean;
  chat_theme: "light" | "dark" | "system";
  chat_enter_is_send: boolean;
  chat_media_visibility: boolean;
  chat_font_size: "small" | "medium" | "large";
  notify_message_tone: string;
  notify_group_tone: string;
  notify_call_ringtone: string;
  notify_high_priority: boolean;
  app_language: string;
}

const defaultSettings: UserSettings = {
  privacy_last_seen: "everyone",
  privacy_profile_photo: "everyone",
  privacy_about: "everyone",
  privacy_status: "my_contacts",
  privacy_read_receipts: true,
  chat_theme: "system",
  chat_enter_is_send: false,
  chat_media_visibility: true,
  chat_font_size: "medium",
  notify_message_tone: "default",
  notify_group_tone: "default",
  notify_call_ringtone: "default",
  notify_high_priority: true,
  app_language: "en",
};

interface SettingsContextType {
  settings: UserSettings;
  updateSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => Promise<void>;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function loadSettings() {
      const user = await getCurrentUser();
      if (!user) {
        setIsLoading(false);
        return;
      }
      setUserId(user.id);

      // Check if Dev Mode
      if (localStorage.getItem("mock_session")) {
        const localSettings = localStorage.getItem("dev_user_settings");
        if (localSettings) {
          setSettings(JSON.parse(localSettings));
        }
        setIsLoading(false);
        return;
      }

      // Fetch from Supabase
      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // Record doesn't exist, try to create it
          await supabase.from("user_settings").insert({ user_id: user.id });
        } else {
          console.error("Error loading settings:", error);
        }
      } else if (data) {
        // Merge with defaults to ensure all keys exist
        setSettings({ ...defaultSettings, ...data });
      }
      setIsLoading(false);
    }
    loadSettings();
  }, []);

  const updateSetting = async <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    // Optimistic update
    const previousSettings = { ...settings };
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    if (localStorage.getItem("mock_session")) {
      localStorage.setItem("dev_user_settings", JSON.stringify(newSettings));
      return;
    }

    if (!userId) return;

    try {
      const { error } = await supabase
        .from("user_settings")
        .update({ [key]: value })
        .eq("user_id", userId);

      if (error) {
        // Rollback on error
        setSettings(previousSettings);
        throw error;
      }
    } catch (err: any) {
      toast.error(`Failed to update setting: ${err.message}`);
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, isLoading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
