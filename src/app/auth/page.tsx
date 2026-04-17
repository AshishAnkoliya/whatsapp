"use client";

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useRouter as useNavigate } from 'next/navigation';

import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare } from 'lucide-react';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [isUpdatePasswordMode, setIsUpdatePasswordMode] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace('#', '?'));
    
    if (searchParams.get('type') === 'recovery' || hashParams.get('type') === 'recovery') {
      setIsUpdatePasswordMode(true);
    }
  }, []);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    if (!email || !password || (isSignUp && !username)) {
      toast.error('Please fill in all fields');
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: { username }
          }
        });
        if (error) throw error;
        
        if (data.session) {
          toast.success('Account created and logged in!');
        } else {
          toast.success('Check your email for the confirmation link!');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success('Logged in successfully!');
      }
    } catch (error: any) {
      toast.error(error.message);
      setLoading(false);
    } finally {
      setTimeout(() => setLoading(false), 1000);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?type=recovery`,
      });
      if (error) throw error;
      toast.success('Password reset link sent to your email!');
      setIsResetMode(false);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!password) {
      toast.error('Please enter a new password');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success('Password updated successfully!');
      setIsUpdatePasswordMode(false);
      navigate.push('/');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDevModeLogin() {
    setLoading(true);
    try {
      const mockUser = {
        id: '00000000-0000-0000-0000-000000000000',
        email: 'dev@example.com',
        user_metadata: { username: 'DevUser' },
        username: 'DevUser'
      };
      const mockSession = { user: mockUser, access_token: 'mock_token' };
      localStorage.setItem('mock_session', JSON.stringify(mockSession));
      window.location.reload();
    } catch (error: any) {
      toast.error('Dev mode login failed');
    } finally {
      setLoading(false);
    }
  }

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: 0.6,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: { opacity: 1, x: 0 }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-50 via-slate-50 to-white">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-10">
          <motion.div 
            whileHover={{ scale: 1.05, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
            className="w-20 h-20 bg-emerald-500 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-emerald-200 mb-6 relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <MessageSquare className="text-white relative z-10" size={40} />
          </motion.div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2 font-display">WhatsApp Pro</h1>
          <p className="text-slate-500 font-medium tracking-wide uppercase text-[10px]">Professional Real-time Chat</p>
        </div>

        <Card className="border border-white/50 bg-white/80 backdrop-blur-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] rounded-[2.5rem] overflow-hidden ring-0 py-0">
          <CardHeader className="space-y-2 pb-6 pt-8 px-8">
            <CardTitle className="text-3xl font-bold tracking-tight text-slate-900">
              {isUpdatePasswordMode ? 'New Password' : (isResetMode ? 'Reset Password' : (isSignUp ? 'Create Account' : 'Welcome Back'))}
            </CardTitle>
            <CardDescription className="text-slate-500 font-medium">
              {isUpdatePasswordMode 
                ? 'Enter your new password below'
                : (isResetMode 
                  ? 'Enter your email to receive a reset link' 
                  : (isSignUp ? 'Join our community today' : 'Sign in to continue your conversations'))}
            </CardDescription>
          </CardHeader>
          
          <form onSubmit={isUpdatePasswordMode ? handleUpdatePassword : (isResetMode ? handleResetPassword : handleAuth)}>
            <CardContent className="space-y-5 px-8">
              <AnimatePresence mode="wait">
                {isSignUp && !isResetMode && !isUpdatePasswordMode && (
                  <motion.div 
                    key="username"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2"
                  >
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Username</label>
                    <div className="relative group">
                    <Input
                      placeholder="johndoe"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      className="bg-slate-50 border border-slate-200/60 rounded-2xl h-14 px-4 shadow-sm transition-all focus-visible:ring-emerald-500/10 focus-visible:border-emerald-500 placeholder:text-slate-400/70 placeholder:font-normal"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!isUpdatePasswordMode && (
              <motion.div variants={itemVariants} className="space-y-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Email Address</label>
                <div className="relative group">
                  <Input
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-slate-50 border border-slate-200/60 rounded-2xl h-14 px-4 shadow-sm transition-all focus-visible:ring-emerald-500/10 focus-visible:border-emerald-500 placeholder:text-slate-400/70 placeholder:font-normal"
                  />
                </div>
              </motion.div>
            )}

            {!isResetMode && (
              <motion.div variants={itemVariants} className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                    {isUpdatePasswordMode ? 'New Password' : 'Password'}
                  </label>
                  {!isSignUp && !isUpdatePasswordMode && (
                    <button 
                      type="button"
                      onClick={() => setIsResetMode(true)}
                      className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-wider cursor-pointer"
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <div className="relative group">
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-slate-50 border border-slate-200/60 rounded-2xl h-14 px-4 shadow-sm transition-all focus-visible:ring-emerald-500/10 focus-visible:border-emerald-500 placeholder:text-slate-400/70 placeholder:font-normal"
                  />
                </div>
              </motion.div>
            )}
            </CardContent>

            <CardFooter className="flex flex-col gap-5 px-8 pb-10 pt-6 border-none bg-transparent">
              <motion.div variants={itemVariants} className="w-full">
                <Button 
                  type="submit" 
                  className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold shadow-xl shadow-emerald-100 transition-all active:scale-[0.98] text-base cursor-pointer" 
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Processing...</span>
                    </div>
                  ) : (
                    isUpdatePasswordMode ? 'Update Password' : (isResetMode ? 'Send Reset Link' : (isSignUp ? 'Create Account' : 'Sign In'))
                  )}
                </Button>
              </motion.div>
              
              {(isResetMode || isUpdatePasswordMode) && (
                <motion.button
                  variants={itemVariants}
                  type="button"
                  onClick={() => {
                    setIsResetMode(false);
                    setIsUpdatePasswordMode(false);
                  }}
                  className="text-sm text-slate-500 font-bold hover:text-slate-700 transition-colors cursor-pointer"
                >
                  Back to Sign In
                </motion.button>
              )}

              {!isResetMode && !isUpdatePasswordMode && (
                <>
                  <motion.div variants={itemVariants} className="relative w-full py-2">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-slate-100"></span>
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase tracking-[0.3em]">
                      <span className="bg-white px-4 text-slate-300 font-bold">Or</span>
                    </div>
                  </motion.div>

                  {/* <motion.div variants={itemVariants} className="w-full">
                    <Button 
                      type="button"
                      variant="outline"
                      onClick={handleDevModeLogin}
                      className="w-full h-14 border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all active:scale-[0.98] bg-slate-50/50" 
                      disabled={loading}
                    >
                      Dev Mode Login
                    </Button>
                  </motion.div> */}

                  <motion.button
                    variants={itemVariants}
                    type="button"
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-sm text-emerald-600 font-bold hover:text-emerald-700 transition-colors cursor-pointer"
                  >
                    {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                  </motion.button>
                </>
              )}
            </CardFooter>
          </form>
        </Card>

        <motion.p 
          variants={itemVariants}
          className="text-center mt-8 text-xs text-slate-400 font-medium uppercase tracking-widest"
        >
          Secure • Encrypted • Fast
        </motion.p>
      </motion.div>
    </div>
  );
}
