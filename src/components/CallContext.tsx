"use client";

import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import Peer, { MediaConnection } from "peerjs";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { toast } from "sonner";

export type CallStatus = 'idle' | 'ringing' | 'ongoing' | 'ended' | 'rejected' | 'missed';
export type CallType = 'audio' | 'video';

interface CallState {
  id: string;
  status: CallStatus;
  type: CallType;
  caller_id: string;
  receiver_id: string;
  remotePeerId?: string;
}

interface CallContextProps {
  currentCall: CallState | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  initiateCall: (receiverId: string, type: CallType) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleVideo: () => void;
  isMuted: boolean;
  isVideoOff: boolean;
  myUserId: string | null;
}

const CallContext = createContext<CallContextProps | undefined>(undefined);

export function CallProvider({ children }: { children: ReactNode }) {
  const [currentCall, setCurrentCall] = useState<CallState | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const peerInstance = useRef<Peer | null>(null);
  // pendingPeerCall = incoming PeerJS call that arrived before user accepted
  const pendingPeerCall = useRef<MediaConnection | null>(null);
  const currentCallRef = useRef<CallState | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => { currentCallRef.current = currentCall; }, [currentCall]);
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);

  useEffect(() => {
    async function init() {
      const user = await getCurrentUser();
      if (!user) return;
      setUserId(user.id);

      const peerId = `wa_${user.id}`;
      // Free TURN servers for NAT traversal (critical for mobile networks)
      const peer = new Peer(peerId, {
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            {
              urls: 'turn:openrelay.metered.ca:80',
              username: 'openrelayproject',
              credential: 'openrelayproject'
            },
            {
              urls: 'turn:openrelay.metered.ca:443',
              username: 'openrelayproject',
              credential: 'openrelayproject'
            },
          ]
        }
      });

      peer.on('open', (id) => {
        console.log('[PeerJS] Connected with ID:', id);
      });

      peer.on('error', (err) => {
        console.error('[PeerJS] Error:', err);
      });

      // When CALLER dials us (receiver side) → save it, answer only after acceptCall()
      peer.on('call', (mediaCall) => {
        console.log('[PeerJS] Incoming media call from:', mediaCall.peer);
        pendingPeerCall.current = mediaCall;

        // If receiver already accepted (stream ready), answer immediately
        if (localStreamRef.current) {
          mediaCall.answer(localStreamRef.current);
          mediaCall.on('stream', (remStream) => {
            console.log('[PeerJS] Got remote stream from caller');
            setRemoteStream(remStream);
          });
          mediaCall.on('close', cleanupCall);
        }
      });

      peerInstance.current = peer;

      // Check for an already-ringing call on load (in case app was opened after call started)
      const { data: existingCall } = await supabase
        .from('calls')
        .select('*')
        .eq('receiver_id', user.id)
        .eq('status', 'ringing')
        .limit(1)
        .maybeSingle();

      if (existingCall) {
        handleCallEvent(existingCall, user.id);
      }

      // Listen to Supabase realtime for call events
      const channel = supabase
        .channel(`calls_${user.id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'calls',
          filter: `receiver_id=eq.${user.id}`
        }, (payload) => {
          console.log('[Supabase] Receiver event:', payload.new);
          handleCallEvent(payload.new as CallState, user.id);
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'calls',
          filter: `caller_id=eq.${user.id}`
        }, (payload) => {
          console.log('[Supabase] Caller event:', payload.new);
          handleCallEvent(payload.new as CallState, user.id);
        })
        .subscribe((status) => {
          console.log('[Supabase] Channel status:', status);
        });

      return () => {
        supabase.removeChannel(channel);
        peer.destroy();
      };
    }
    init();
  }, []);

  const handleCallEvent = async (callData: CallState, myId: string) => {
    if (!callData || !callData.id) return;

    const activeCall = currentCallRef.current;

    // -- New ringing call while we're busy → auto-reject
    if (activeCall && activeCall.id !== callData.id && callData.status === 'ringing') {
      if (myId === callData.receiver_id) {
        await supabase.from('calls').update({ status: 'rejected' }).eq('id', callData.id);
      }
      return;
    }

    // -- Call ended/rejected/missed → cleanup
    if (callData.status === 'ended' || callData.status === 'rejected' || callData.status === 'missed') {
      setCurrentCall(prev => prev?.id === callData.id ? { ...prev, status: callData.status } : prev);
      setTimeout(cleanupCall, 1000); // small delay so UI shows "ended"
      return;
    }

    // -- Update local call state
    setCurrentCall({
      id: callData.id,
      status: callData.status,
      type: callData.type,
      caller_id: callData.caller_id,
      receiver_id: callData.receiver_id,
      remotePeerId: `wa_${myId === callData.receiver_id ? callData.caller_id : callData.receiver_id}`
    });

    // -- Receiver accepted → Caller now initiates the PeerJS media call
    if (callData.status === 'ongoing' && myId === callData.caller_id) {
      console.log('[Caller] Receiver accepted! Initiating PeerJS call...');
      const stream = await startMedia(callData.type);
      if (!stream || !peerInstance.current) return;

      const remoteId = `wa_${callData.receiver_id}`;
      console.log('[Caller] Calling peer:', remoteId);
      const mediaCall = peerInstance.current.call(remoteId, stream);

      mediaCall.on('stream', (remStream) => {
        console.log('[Caller] Got remote stream from receiver!');
        setRemoteStream(remStream);
      });
      mediaCall.on('close', cleanupCall);
      mediaCall.on('error', (e) => console.error('[Caller] MediaCall error:', e));

      pendingPeerCall.current = mediaCall;
    }
  };

  const startMedia = async (type: CallType): Promise<MediaStream | null> => {
    // Don't request again if we already have it
    if (localStreamRef.current) return localStreamRef.current;
    try {
      const constraints = type === 'video'
        ? { video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true }
        : { video: false, audio: true };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      localStreamRef.current = stream;
      console.log('[Media] Got local stream, tracks:', stream.getTracks().map(t => t.kind));
      return stream;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Camera/Mic error: ${msg}. Please allow access.`);
      return null;
    }
  };

  const cleanupCall = () => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    pendingPeerCall.current?.close();
    setCurrentCall(null);
    setLocalStream(null);
    setRemoteStream(null);
    localStreamRef.current = null;
    currentCallRef.current = null;
    pendingPeerCall.current = null;
    setIsMuted(false);
    setIsVideoOff(false);
  };

  const initiateCall = async (receiverId: string, type: CallType) => {
    if (!userId) return;

    // Get media first (cam/mic permission)
    const stream = await startMedia(type);
    if (!stream) return;

    const { data, error } = await supabase
      .from('calls')
      .insert({ caller_id: userId, receiver_id: receiverId, type, status: 'ringing' })
      .select()
      .single();

    if (error || !data) {
      toast.error('Failed to make call. Please try again.');
      cleanupCall();
      return;
    }

    setCurrentCall({
      id: data.id,
      status: 'ringing',
      type,
      caller_id: userId,
      receiver_id: receiverId,
      remotePeerId: `wa_${receiverId}`
    });
  };

  const acceptCall = async () => {
    if (!currentCall || !userId) return;

    // Get receiver's own camera/mic first
    const stream = await startMedia(currentCall.type);
    if (!stream) {
      rejectCall();
      return;
    }

    // Update DB → this triggers Caller's handleCallEvent with status='ongoing'
    const { error } = await supabase
      .from('calls')
      .update({ status: 'ongoing' })
      .eq('id', currentCall.id);

    if (error) {
      toast.error('Failed to accept call');
      return;
    }

    // If PeerJS call from Caller already arrived → answer it now with our stream
    if (pendingPeerCall.current) {
      console.log('[Receiver] Answering pending PeerJS call');
      pendingPeerCall.current.answer(stream);
      pendingPeerCall.current.on('stream', (remStream) => {
        console.log('[Receiver] Got caller stream!');
        setRemoteStream(remStream);
      });
      pendingPeerCall.current.on('close', cleanupCall);
    } else {
      // PeerJS call hasn't arrived yet → set up listener to answer when it comes
      console.log('[Receiver] Waiting for PeerJS call from caller...');
      if (peerInstance.current) {
        const handler = (mediaCall: MediaConnection) => {
          console.log('[Receiver] PeerJS call arrived, answering...');
          pendingPeerCall.current = mediaCall;
          mediaCall.answer(stream);
          mediaCall.on('stream', (remStream) => {
            console.log('[Receiver] Got caller stream!');
            setRemoteStream(remStream);
          });
          mediaCall.on('close', cleanupCall);
          // Remove listener after answering
          peerInstance.current?.off('call', handler);
        };
        peerInstance.current.on('call', handler);
      }
    }
  };

  const rejectCall = async () => {
    if (!currentCall) return;
    await supabase.from('calls').update({ status: 'rejected' }).eq('id', currentCall.id);
    cleanupCall();
  };

  const endCall = async () => {
    if (!currentCall) return;
    await supabase.from('calls').update({ status: 'ended' }).eq('id', currentCall.id);
    cleanupCall();
  };

  const toggleMute = () => {
    const audio = localStream?.getAudioTracks()[0];
    if (audio) {
      audio.enabled = !audio.enabled;
      setIsMuted(!audio.enabled);
    }
  };

  const toggleVideo = () => {
    const video = localStream?.getVideoTracks()[0];
    if (video) {
      video.enabled = !video.enabled;
      setIsVideoOff(!video.enabled);
    }
  };

  return (
    <CallContext.Provider value={{
      currentCall, localStream, remoteStream,
      initiateCall, acceptCall, rejectCall, endCall,
      toggleMute, toggleVideo, isMuted, isVideoOff,
      myUserId: userId
    }}>
      {children}
    </CallContext.Provider>
  );
}

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) throw new Error('useCall must be used within a CallProvider');
  return context;
};
