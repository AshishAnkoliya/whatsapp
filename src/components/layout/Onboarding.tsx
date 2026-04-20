"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Download, X, CheckCircle2, ShieldCheck, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { subscribeToPush } from '@/lib/push';
import { toast } from 'sonner';

interface OnboardingProps {
  userId: string;
}

export default function Onboarding({ userId }: OnboardingProps) {
  const [step, setStep] = useState<'none' | 'notifications' | 'install'>('none');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if notifications need prompting
    if ('Notification' in window && Notification.permission === 'default') {
      // Delay slightly for better UX
      const timer = setTimeout(() => setStep('notifications'), 2000);
      return () => clearTimeout(timer);
    }

    // Listen for PWA install prompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // If notification is already handled, show install
      if (Notification.permission !== 'default') {
        setStep('install');
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check for iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleEnableNotifications = async () => {
    try {
      await subscribeToPush(userId);
      toast.success('Notifications enabled!');
      
      // Move to next step or close
      if (deferredPrompt || isIOS) {
        setStep('install');
      } else {
        setStep('none');
      }
    } catch (error: any) {
      if (error.message !== 'Notification permission denied') {
        toast.error('Failed to enable notifications');
      }
      setStep('none');
    }
  };

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to install prompt: ${outcome}`);
      setDeferredPrompt(null);
      setStep('none');
    }
  };

  if (step === 'none') return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
      <AnimatePresence mode="wait">
        {step === 'notifications' && (
          <motion.div
            key="notifications"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: -20 }}
            className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4">
              <button 
                onClick={() => setStep(deferredPrompt || isIOS ? 'install' : 'none')}
                className="p-2 text-slate-300 hover:text-slate-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center text-emerald-600">
                <Bell size={40} className="animate-bounce" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-black text-slate-900 leading-tight">Don't Miss a Message</h2>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Enable notifications to get real-time alerts when your friends message you.
                </p>
              </div>

              <div className="space-y-3 w-full pt-4 font-bold">
                <Button 
                  onClick={handleEnableNotifications}
                  className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-200 transition-all active:scale-[0.98]"
                >
                  Enable Notifications
                </Button>
                <button 
                  onClick={() => setStep(deferredPrompt || isIOS ? 'install' : 'none')}
                  className="w-full h-12 text-slate-400 hover:text-slate-600 transition-colors text-sm"
                >
                  Maybe Later
                </button>
              </div>

              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest pt-2">
                <ShieldCheck size={14} className="text-emerald-500" />
                Secure & Encrypted
              </div>
            </div>
          </motion.div>
        )}

        {step === 'install' && (
          <motion.div
            key="install"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: -20 }}
            className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4">
              <button 
                onClick={() => setStep('none')}
                className="p-2 text-slate-300 hover:text-slate-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-20 h-20 bg-blue-100 rounded-3xl flex items-center justify-center text-blue-600">
                <Smartphone size={40} />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-black text-slate-900 leading-tight">Install WhatsApp Pro</h2>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {isIOS 
                    ? "Tap the Share icon and then 'Add to Home Screen' to install this app on your iPhone."
                    : "Install our app for a smoother, faster, and more reliable experience."}
                </p>
              </div>

              <div className="space-y-3 w-full pt-4 font-bold">
                {!isIOS ? (
                  <Button 
                    onClick={handleInstallApp}
                    className="w-full h-14 bg-slate-900 hover:bg-black text-white rounded-2xl shadow-lg shadow-slate-200 transition-all active:scale-[0.98]"
                  >
                    Install Now
                  </Button>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-600 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-white border border-slate-200 rounded flex items-center justify-center">1</div>
                      <p>Tap the <b>Share</b> button in Safari</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-white border border-slate-200 rounded flex items-center justify-center">2</div>
                      <p>Select <b>'Add to Home Screen'</b></p>
                    </div>
                  </div>
                )}
                <button 
                  onClick={() => setStep('none')}
                  className="w-full h-12 text-slate-400 hover:text-slate-600 transition-colors text-sm"
                >
                  Close
                </button>
              </div>

              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest pt-2">
                <CheckCircle2 size={14} className="text-blue-500" />
                Premium Experience
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
