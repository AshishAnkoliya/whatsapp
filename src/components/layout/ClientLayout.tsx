"use client";

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import BottomNav from './BottomNav';
import { Toaster } from '@/components/ui/sonner';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import Auth from '@/app/auth/page';
import Onboarding from './Onboarding';
import { CallScreen } from '../CallScreen';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isChatPage = pathname?.startsWith('/chat/');
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for mock session in localStorage
    const mockSession = localStorage.getItem('mock_session');
    if (mockSession) {
      setSession(JSON.parse(mockSession));
      setLoading(false);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mockSession) {
        setSession(session);
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!localStorage.getItem('mock_session')) {
        setSession(session);
      }
    });

    // Update last seen periodically
    const updateLastSeen = async () => {
      const user = await getCurrentUser();
      if (user && !localStorage.getItem('mock_session')) {
        await supabase
          .from('profiles')
          .update({ last_seen: new Date().toISOString() })
          .eq('id', user.id);
      }
    };

    updateLastSeen();
    const interval = setInterval(updateLastSeen, 60000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 w-full h-full">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <>
      <div className={cn("flex-1 min-h-0 relative", !isChatPage && "pb-20")}>
        {children}
      </div>
      {!isChatPage && <BottomNav />}
      {session?.user?.id && <Onboarding userId={session.user.id} />}
      <CallScreen />
      <Toaster position="top-center" />
    </>
  );
}
