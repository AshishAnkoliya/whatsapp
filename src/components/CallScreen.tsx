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
    isVideoOff
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
    return (
      <div className="fixed inset-0 z-[100] bg-slate-900 text-white flex flex-col items-center justify-between py-24">
        {/* Fake ringing sound could be played here */}
        <div className="flex flex-col items-center gap-6">
          <Avatar className="w-32 h-32 border-4 border-slate-700 pointer-events-none">
            <AvatarFallback className="bg-emerald-600 text-4xl">U</AvatarFallback>
          </Avatar>
          <div className="text-center">
            <h2 className="text-3xl font-light mb-2">WhatsApp Call</h2>
            <p className="text-slate-400">Incoming...</p>
          </div>
        </div>

        <div className="flex gap-16">
          <button 
            onClick={() => rejectCall()}
            className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center animate-bounce-slow"
          >
            <PhoneOff className="text-white" size={28} />
          </button>
          
          {/* If I'm the receiver, I can answer. If I'm the caller, I wait. */}
          <button 
            onClick={() => acceptCall()}
            className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center animate-pulse"
          >
            <Phone className="text-white" size={28} />
          </button>
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
