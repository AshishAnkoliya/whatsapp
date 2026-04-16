"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, Users, Settings, Phone } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

export default function BottomNav() {
  const pathname = usePathname();
  
  const navItems = [
    { icon: MessageSquare, label: 'Chats', path: '/' },
    { icon: Users, label: 'Groups', path: '/groups' },
    { icon: Phone, label: 'Calls', path: '/calls' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white/80 backdrop-blur-xl border-t border-slate-100 px-6 py-3 flex justify-between items-center z-50">
      {navItems.map((item) => {
        const isActive = pathname === item.path;
        return (
          <Link
            key={item.path}
            href={item.path}
            className={
              cn(
                "flex flex-col items-center gap-1 transition-all duration-300 relative",
                isActive ? "text-emerald-600" : "text-slate-400 hover:text-slate-600"
              )
            }
          >
            <item.icon size={24} strokeWidth={isActive ? 2.5 : 2} />
            <span className="text-[10px] font-medium uppercase tracking-wider">{item.label}</span>
            {isActive && (
              <motion.div
                layoutId="activeNav"
                className="absolute -top-3 w-1 h-1 bg-emerald-600 rounded-full"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
