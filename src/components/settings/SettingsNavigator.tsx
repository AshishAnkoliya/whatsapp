"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft } from "lucide-react";

import { RootScreen } from "./screens/RootScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { PrivacyScreen } from "./screens/PrivacyScreen";
import { ChatsScreen } from "./screens/ChatsScreen";
import { AccountScreen, NotificationsScreen, StorageDataScreen, HelpScreen } from "./screens/MiscScreens";

export type ScreenName = 
  | "root"
  | "profile"
  | "account"
  | "privacy"
  | "chats"
  | "notifications"
  | "storage"
  | "help";

export function SettingsNavigator() {
  const [stack, setStack] = useState<ScreenName[]>(["root"]);
  const [direction, setDirection] = useState<1 | -1>(1);

  const push = (screen: ScreenName) => {
    setDirection(1);
    setStack((prev) => [...prev, screen]);
  };

  const pop = () => {
    if (stack.length <= 1) return;
    setDirection(-1);
    setStack((prev) => prev.slice(0, -1));
  };

  const currentScreen = stack[stack.length - 1];

  const renderScreen = () => {
    switch (currentScreen) {
      case "root": return <RootScreen onNavigate={push} />;
      case "profile": return <ProfileScreen onBack={pop} />;
      case "account": return <AccountScreen onBack={pop} />;
      case "privacy": return <PrivacyScreen onBack={pop} />;
      case "chats": return <ChatsScreen onBack={pop} />;
      case "notifications": return <NotificationsScreen onBack={pop} />;
      case "storage": return <StorageDataScreen onBack={pop} />;
      case "help": return <HelpScreen onBack={pop} />;
      default: return <RootScreen onNavigate={push} />;
    }
  };

  const variants = {
    enter: (direction: number) => {
      return {
        x: direction > 0 ? "100%" : "-100%",
        opacity: 0,
      };
    },
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => {
      return {
        x: direction < 0 ? "100%" : "-100%",
        opacity: 0,
      };
    },
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-50">
      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        <motion.div
          key={currentScreen}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: "spring", stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 },
          }}
          className="absolute inset-0 w-full h-full pb-16"
        >
          {renderScreen()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// A reusable header for sub-screens
export function SubScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="px-4 py-4 bg-white border-b border-slate-100 flex items-center gap-3 sticky top-0 z-40">
      <button 
        onClick={onBack}
        className="p-2 -ml-2 rounded-full hover:bg-slate-100 active:bg-slate-200 transition-colors"
      >
        <ChevronLeft size={24} className="text-slate-700" />
      </button>
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
    </header>
  );
}
