"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useCall } from './CallContext';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

// Corner light beam component – replicates the "star warp" feel from the image
function CornerBeams() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {/* Top-left beams */}
      <div className="absolute top-0 left-0 w-full h-full">
        {[...Array(8)].map((_, i) => (
          <div
            key={`tl-${i}`}
            className="absolute top-0 left-0 origin-top-left"
            style={{
              width: '1px',
              height: `${180 + i * 40}px`,
              background: `linear-gradient(to bottom, ${['#00e5ff','#0080ff','#7c3aed','#00ffaa','#ff0080','#ffd700','#00e5ff','#0080ff'][i]}99, transparent)`,
              transform: `rotate(${15 + i * 8}deg)`,
              opacity: 0.7,
              animation: `beam-pulse ${2 + i * 0.3}s ease-in-out infinite alternate`,
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
      {/* Top-right beams */}
      <div className="absolute top-0 right-0 w-full h-full">
        {[...Array(8)].map((_, i) => (
          <div
            key={`tr-${i}`}
            className="absolute top-0 right-0 origin-top-right"
            style={{
              width: '1px',
              height: `${180 + i * 40}px`,
              background: `linear-gradient(to bottom, ${['#7c3aed','#ff0080','#00e5ff','#ffd700','#00ffaa','#0080ff','#ff0080','#7c3aed'][i]}99, transparent)`,
              transform: `rotate(${-(15 + i * 8)}deg)`,
              opacity: 0.7,
              animation: `beam-pulse ${2.2 + i * 0.3}s ease-in-out infinite alternate`,
              animationDelay: `${i * 0.25}s`,
            }}
          />
        ))}
      </div>
      {/* Bottom-left beams */}
      <div className="absolute bottom-0 left-0 w-full h-full">
        {[...Array(6)].map((_, i) => (
          <div
            key={`bl-${i}`}
            className="absolute bottom-0 left-0 origin-bottom-left"
            style={{
              width: '1px',
              height: `${120 + i * 35}px`,
              background: `linear-gradient(to top, ${['#00ffaa','#0080ff','#7c3aed','#00e5ff','#ff0080','#ffd700'][i]}88, transparent)`,
              transform: `rotate(${-(20 + i * 9)}deg)`,
              opacity: 0.6,
              animation: `beam-pulse ${2.5 + i * 0.3}s ease-in-out infinite alternate`,
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
      {/* Bottom-right beams */}
      <div className="absolute bottom-0 right-0 w-full h-full">
        {[...Array(6)].map((_, i) => (
          <div
            key={`br-${i}`}
            className="absolute bottom-0 right-0 origin-bottom-right"
            style={{
              width: '1px',
              height: `${120 + i * 35}px`,
              background: `linear-gradient(to top, ${['#ffd700','#00e5ff','#ff0080','#00ffaa','#7c3aed','#0080ff'][i]}88, transparent)`,
              transform: `rotate(${20 + i * 9}deg)`,
              opacity: 0.6,
              animation: `beam-pulse ${1.8 + i * 0.3}s ease-in-out infinite alternate`,
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

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
  const [callDuration, setCallDuration] = useState(0);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, currentCall?.status]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, currentCall?.status]);

  // Call duration timer
  useEffect(() => {
    if (currentCall?.status !== 'ongoing') { setCallDuration(0); return; }
    const t = setInterval(() => setCallDuration(d => d + 1), 1000);
    return () => clearInterval(t);
  }, [currentCall?.status]);

  if (!currentCall) return null;

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  /* ── RINGING SCREEN ── */
  if (currentCall.status === 'ringing') {
    const isCaller = currentCall.caller_id === myUserId;
    const isVideo = currentCall.type === 'video';

    return (
      <div className="fixed inset-0 z-[100] text-white flex flex-col items-center justify-between overflow-hidden" style={{ background: 'radial-gradient(ellipse at 50% 30%, #0a1628 0%, #050d18 100%)' }}>

        {/* Beam animations CSS */}
        <style>{`
          @keyframes beam-pulse {
            0% { opacity: 0.3; transform-origin: inherit; }
            100% { opacity: 0.9; }
          }
          @keyframes ring-expand {
            0% { transform: scale(0.8); opacity: 0.8; }
            100% { transform: scale(2.2); opacity: 0; }
          }
        `}</style>

        {/* Corner light beams */}
        <CornerBeams />

        {/* Ringtone */}
        <audio autoPlay loop src={isCaller ? "/outgoing_ring.mp3" : "/ringtone.mp3"} style={{ display: 'none' }} />

        {/* Caller's own camera preview as background */}
        {isCaller && isVideo && localStream && (
          <div className="absolute inset-0">
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover opacity-40" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(5,13,24,0.85) 0%, rgba(5,13,24,0.3) 50%, rgba(5,13,24,0.95) 100%)' }} />
          </div>
        )}

        {/* Top label */}
        <div className="relative z-10 mt-16 text-center">
          <p className="text-xs tracking-[0.3em] uppercase text-cyan-400/70 mb-1">
            {isVideo ? '📹 Video Call' : '🎤 Voice Call'}
          </p>
          <h1 className="text-2xl font-semibold tracking-wide text-white/90">WhatsApp</h1>
        </div>

        {/* Pulsing avatar */}
        <div className="relative z-10 flex flex-col items-center gap-6">
          <div className="relative flex items-center justify-center">
            {/* Expanding rings */}
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="absolute rounded-full border"
                style={{
                  width: '128px', height: '128px',
                  borderColor: ['#00e5ff', '#7c3aed', '#00ffaa'][i] + '60',
                  animation: `ring-expand 3s ease-out infinite`,
                  animationDelay: `${i * 1}s`,
                }}
              />
            ))}
            <Avatar className="w-32 h-32 border-2 shadow-2xl relative z-10" style={{ borderColor: '#00e5ff40' }}>
              <AvatarFallback className="text-5xl font-light" style={{ background: 'linear-gradient(135deg, #1a3a5c, #0a4d68)' }}>
                {isCaller ? '👤' : '📲'}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="text-center">
            <h2 className="text-3xl font-light tracking-wide mb-2">
              {isCaller ? 'Calling...' : 'Incoming Call'}
            </h2>
            {isCaller ? (
              <div className="flex items-center justify-center gap-1.5">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            ) : (
              <p className="text-emerald-400 font-medium animate-pulse">Tap Accept to connect</p>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="relative z-10 flex gap-16 mb-16">
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => isCaller ? endCall() : rejectCall()}
              className="w-16 h-16 rounded-full flex items-center justify-center transition-transform active:scale-90 shadow-lg"
              style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', boxShadow: '0 0 20px #dc262660' }}
            >
              <PhoneOff size={26} className="text-white" />
            </button>
            <span className="text-xs text-slate-400">{isCaller ? 'Cancel' : 'Decline'}</span>
          </div>

          {!isCaller && (
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <div className="absolute inset-0 rounded-full animate-ping" style={{ background: '#10b981', opacity: 0.4 }} />
                <button
                  onClick={acceptCall}
                  className="w-16 h-16 rounded-full flex items-center justify-center relative z-10 transition-transform active:scale-90"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 0 28px #10b98160' }}
                >
                  <Phone size={26} className="text-white fill-white" />
                </button>
              </div>
              <span className="text-xs text-slate-400">Accept</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── ONGOING CALL SCREEN ── */
  if (currentCall.status === 'ongoing') {
    const isVideo = currentCall.type === 'video';
    const hasRemoteStream = !!remoteStream;

    return (
      <div className="fixed inset-0 z-[100] bg-slate-900 text-white flex flex-col overflow-hidden">
        {/* Ongoing Call Premium UI */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute -top-[20%] -left-[20%] w-[40%] h-[40%] bg-cyan-600/30 blur-[100px] rounded-full animate-[pulse_4s_ease-in-out_infinite]" />
          <div className="absolute -bottom-[20%] -right-[20%] w-[40%] h-[40%] bg-purple-600/30 blur-[100px] rounded-full animate-[pulse_5s_ease-in-out_infinite_1s]" />
        </div>

        {/* Remote Video / Avatar */}
        <div className="flex-1 relative bg-black/90 flex items-center justify-center z-10 overflow-hidden">
          {/* Always render an audio element for Voice Calls so remote audio routes to speakers */}
          {!isVideo && hasRemoteStream && (
            <audio ref={remoteVideoRef as React.RefObject<HTMLAudioElement>} autoPlay playsInline className="hidden" />
          )}
          
          {isVideo && hasRemoteStream ? (
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-4">
              <Avatar className="w-40 h-40 border-2" style={{ borderColor: '#00e5ff30' }}>
                <AvatarFallback className="text-6xl" style={{ background: 'linear-gradient(135deg, #1a3a5c, #0a4d68)' }}>
                  👤
                </AvatarFallback>
              </Avatar>
              {!hasRemoteStream && isVideo && (
                <p className="text-cyan-400/70 text-sm animate-pulse">Connecting video...</p>
              )}
            </div>
          )}

          {/* Duration badge */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-sm font-mono backdrop-blur-md z-10"
            style={{ background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.2)', color: '#00e5ff' }}>
            {formatDuration(callDuration)}
          </div>

          {/* Local PiP */}
          {isVideo && localStream && (
            <div className="absolute top-4 right-4 w-24 h-36 rounded-xl overflow-hidden z-10 shadow-2xl"
              style={{ border: '2px solid rgba(0,229,255,0.3)' }}>
              <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              {isVideoOff && (
                <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
                  <VideoOff size={20} className="text-slate-500" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="relative z-10 pb-10 pt-6 flex justify-center items-center gap-8 rounded-t-3xl backdrop-blur-xl"
          style={{ background: 'linear-gradient(to top, rgba(5,13,24,0.98), rgba(10,22,40,0.90))' }}>

          <ControlBtn onClick={toggleVideo} active={isVideoOff} label={isVideoOff ? 'Cam Off' : 'Camera'}>
            {isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
          </ControlBtn>

          <ControlBtn onClick={toggleMute} active={isMuted} label={isMuted ? 'Muted' : 'Mute'}>
            {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
          </ControlBtn>

          {/* End call - large red */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={endCall}
              className="w-16 h-16 rounded-full flex items-center justify-center transition-transform active:scale-90"
              style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', boxShadow: '0 0 24px #dc262650' }}
            >
              <PhoneOff size={26} />
            </button>
            <span className="text-xs text-slate-500">End</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function ControlBtn({ onClick, active, label, children }: {
  onClick: () => void;
  active: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={onClick}
        className="w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90"
        style={{
          background: active ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)',
          border: `1px solid ${active ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.12)'}`,
          color: active ? '#f87171' : '#cbd5e1',
        }}
      >
        {children}
      </button>
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}
