"use client";

import React from "react";
import { SettingsProvider } from "@/components/settings/SettingsContext";
import { SettingsNavigator } from "@/components/settings/SettingsNavigator";

export default function Settings() {
  return (
    <SettingsProvider>
      <div className="w-full h-full bg-slate-50 relative overflow-hidden">
        <SettingsNavigator />
      </div>
    </SettingsProvider>
  );
}
