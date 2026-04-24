"use client";

import React, { useEffect, useRef } from 'react';
import { useCall } from './CallContext';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Camera } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export function CallScreen() {
  const {
    currentCall,
    localStream,
    remoteStream,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    isMuted,
    isVideoOff,
    myUserId
  } = useCall();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  if (!currentCall) return null;

  if (currentCall.status === 'ringing') {
    const isCaller = currentCall.caller_id === myUserId;
    const isVideo = currentCall.type === 'video';

    return (
      <div className="fixed inset-0 z-[100] bg-slate-900 text-white flex flex-col items-center justify-between py-24 overflow-hidden selection:bg-transparent">

        {/* Ringtone Audio - Place ringtone.mp3 in public folder! */}
        <audio autoPlay loop src="/ringtone.mp3" className="hidden" />

        {/* Background Video Preview for Caller */}
        {isCaller && isVideo && localStream && (
          <div className="absolute inset-0 z-[-1]">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover opacity-60"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 via-transparent to-slate-900/95" />
          </div>
        )}
        {(!isCaller || !isVideo || !localStream) && (
          <div className="absolute inset-0 z-[-1] bg-gradient-to-br from-slate-800 to-slate-950" />
        )}

        <div className="flex flex-col items-center gap-8 relative z-10 mt-10">

          {/* Animated Avatar Group */}
          <div className="relative flex items-center justify-center">
            {/* Ripple Effects */}
            <div className="absolute w-40 h-40 rounded-full bg-emerald-500/20 animate-ping" style={{ animationDuration: '3s' }} />
            <div className="absolute w-56 h-56 rounded-full bg-emerald-500/10 animate-ping" style={{ animationDuration: '3s', animationDelay: '1s' }} />
            <div className="absolute w-72 h-72 rounded-full border border-emerald-500/20 animate-pulse" />

            <Avatar className="w-32 h-32 border-4 border-slate-700/50 shadow-2xl relative z-10 backdrop-blur-sm">
              <AvatarFallback className="bg-gradient-to-tr from-emerald-600 to-emerald-400 text-5xl text-white shadow-inner">
                U
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="text-center drop-shadow-2xl">
            <h2 className="text-4xl font-light mb-3 tracking-wide">{currentCall.type === 'video' ? 'WhatsApp Video' : 'WhatsApp Voice'}</h2>
            <div className="flex items-center justify-center gap-2">
              {isCaller ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" />
                  <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce delay-100" />
                  <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce delay-200" />
                  <p className="text-slate-300 font-medium text-lg tracking-widest ml-2 uppercase text-sm">Calling</p>
                </>
              ) : (
                <p className="text-emerald-400 font-semibold text-xl tracking-wider animate-pulse">Incoming...</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-20 relative z-10 mb-10 w-full justify-center">

          {/* Decline / Cancel Button */}
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => isCaller ? endCall() : rejectCall()}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg shadow-red-500/30 transition-transform active:scale-95"
            >
              <PhoneOff className="text-white" size={28} />
            </button>
            <span className="text-sm font-medium text-slate-300">{isCaller ? 'Cancel' : 'Decline'}</span>
          </div>

          {/* Only show Accept to the Receiver */}
          {!isCaller && (
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-75" />
                <button
                  onClick={() => acceptCall()}
                  className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/40 relative z-10 transition-transform active:scale-95"
                >
                  <Phone className="text-white fill-white" size={28} />
                </button>
              </div>
              <span className="text-sm font-medium text-slate-300">Accept</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (currentCall.status === 'ongoing') {
    const isVideo = currentCall.type === 'video';

    return (
      <div className="fixed inset-0 z-[100] bg-slate-900 text-white flex flex-col overflow-hidden">

        {/* Remote Video / Avatar */}
        <div className="flex-1 relative bg-black flex items-center justify-center">
          {isVideo && remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <Avatar className="w-48 h-48 border-4 border-slate-800">
              <AvatarFallback className="bg-emerald-800 text-6xl">U</AvatarFallback>
            </Avatar>
          )}

          {/* Local PiP Video */}
          {isVideo && localStream && (
            <div className="absolute top-4 right-4 w-28 h-40 bg-slate-800 rounded-lg overflow-hidden border-2 border-slate-600 shadow-xl z-10">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>

        {/* Controls Bar */}
        <div className="bg-slate-800/80 backdrop-blur-md p-6 pb-12 flex justify-between items-center px-12 rounded-t-3xl">
          <button className="p-4 bg-slate-700/50 rounded-full hover:bg-slate-600 transition-colors" onClick={toggleVideo}>
            {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
          </button>

          <button className="p-4 bg-slate-700/50 rounded-full hover:bg-slate-600 transition-colors" onClick={toggleMute}>
            {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
          </button>

          <button
            className="p-5 bg-red-500 rounded-full hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
            onClick={endCall}
          >
            <PhoneOff size={28} />
          </button>
        </div>

      </div>
    );
  }

  return null;
}
