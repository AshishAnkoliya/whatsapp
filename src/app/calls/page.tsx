"use client";

import { Phone, Search, Plus, Video } from 'lucide-react';
import { motion } from 'motion/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';

export default function Calls() {
  return (
    <div className="flex flex-col h-full bg-slate-50">
      <header className="px-4 py-6 bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-slate-900">Calls</h1>
          <div className="flex gap-2">
            <motion.button 
              whileTap={{ scale: 0.9 }}
              className="w-10 h-10 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center"
            >
              <Video size={20} />
            </motion.button>
            <motion.button 
              whileTap={{ scale: 0.9 }}
              className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-100"
            >
              <Plus size={20} />
            </motion.button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input 
            placeholder="Search calls..." 
            className="pl-10 bg-slate-50 border-none rounded-xl h-11 focus-visible:ring-emerald-500/20"
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto touch-pan-y">
        <div className="flex flex-col items-center justify-center py-20 px-10 text-center">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-20 h-20 bg-blue-100 text-blue-600 rounded-3xl flex items-center justify-center mb-6"
          >
            <Phone size={40} />
          </motion.div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">No Recent Calls</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            To start calling contacts who have WhatsApp, tap the plus icon at the top of your screen.
          </p>
          <div className="mt-8 flex flex-col gap-4 w-full">
            <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100">
              <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                <Plus size={20} />
              </div>
              <div className="text-left">
                <p className="font-bold text-sm">Create call link</p>
                <p className="text-xs text-slate-400">Share a link for your WhatsApp call</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
