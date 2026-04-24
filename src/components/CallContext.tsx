"use client";

import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import Peer, { MediaConnection } from "peerjs";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { toast } from "sonner";

export type CallStatus = 'idle' | 'ringing' | 'ongoing' | 'ended' | 'rejected';
export type CallType = 'audio' | 'video';

interface CallState {
  id: string; // The call ID from Supabase
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
  const currentConnection = useRef<MediaConnection | null>(null);
  const currentCallRef = useRef<CallState | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => { currentCallRef.current = currentCall; }, [currentCall]);
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);

  // Initialize PeerJS and Supabase Realtime when user logs in
  useEffect(() => {
    async function init() {
      const user = await getCurrentUser();
      if (!user) return;
      setUserId(user.id);

      // Create Peer
      const peerId = `whatsapp_user_${user.id}`;
      const peer = new Peer(peerId);
      
      peer.on('open', (id) => {
        console.log('My peer ID is: ' + id);
      });

      peer.on('call', (call) => {
        // We received a P2P call. We should only answer it if our Supabase state is 'ongoing' (we accepted it)
        // But for now, we save it to the ref and wait for the user to accept.
        currentConnection.current = call;
      });

      peerInstance.current = peer;

      // Check if there is an already ringing call for me when I open the app
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

      // Listen to Supabase `calls` table
      const subscription = supabase
        .channel('public:calls')
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'calls',
            filter: `receiver_id=eq.${user.id}` 
        }, payload => {
            handleCallEvent(payload.new as any, user.id);
        })
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'calls',
            filter: `caller_id=eq.${user.id}` 
        }, payload => {
            handleCallEvent(payload.new as any, user.id);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
        if (peerInstance.current) {
          peerInstance.current.destroy();
        }
      };
    }
    init();
  }, []);

  const handleCallEvent = async (callData: any, myUserId: string) => {
    if (!callData) return;
    
    // Ignore updates for old calls if we have an active one
    if (currentCallRef.current && currentCallRef.current.id !== callData.id && callData.status === 'ringing') {
        // Automatically reject if busy (or we could just return)
        if (myUserId === callData.receiver_id) {
            await supabase.from('calls').update({ status: 'rejected' }).eq('id', callData.id);
        }
        return;
    }

    // Set new call
    setCurrentCall({
        id: callData.id,
        status: callData.status,
        type: callData.type,
        caller_id: callData.caller_id,
        receiver_id: callData.receiver_id,
        remotePeerId: `whatsapp_user_${myUserId === callData.receiver_id ? callData.caller_id : callData.receiver_id}`
    });

    if (callData.status === 'ended' || callData.status === 'rejected' || callData.status === 'missed') {
        cleanupCall();
    } else if (callData.status === 'ongoing' && myUserId === callData.caller_id) {
        // Receiver accepted. Caller initiates Peer connection.
        const stream = await startMedia(callData.type);
        if (peerInstance.current && stream) {
            const remoteId = `whatsapp_user_${callData.receiver_id}`;
            const call = peerInstance.current.call(remoteId, stream);
            currentConnection.current = call;
            call.on('stream', (userVideoStream) => {
                setRemoteStream(userVideoStream);
            });
            call.on('close', () => {
                cleanupCall();
            });
        }
    }
  };

  const startMedia = async (type: CallType): Promise<MediaStream | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: type === 'video',
        audio: true
      });
      setLocalStream(stream);
      localStreamRef.current = stream;
      return stream;
    } catch (err: any) {
      toast.error(`Media access error: ${err.message}`);
      return null;
    }
  };

  const cleanupCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (currentConnection.current) {
      currentConnection.current.close();
    }
    setCurrentCall(null);
    setLocalStream(null);
    setRemoteStream(null);
    localStreamRef.current = null;
    currentCallRef.current = null;
    setIsMuted(false);
    setIsVideoOff(false);
  };

  const initiateCall = async (receiverId: string, type: CallType) => {
    if (!userId) return;
    
    // Request media first to ensure permissions before ringing
    const stream = await startMedia(type);
    if (!stream) return;

    // Create call in DB
    const { data, error } = await supabase.from('calls').insert({
        caller_id: userId,
        receiver_id: receiverId,
        type: type,
        status: 'ringing'
    }).select().single();

    if (error) {
        toast.error("Failed to make call");
        cleanupCall();
        return;
    }

    // Trigger Push Notification to wake up receiver's phone if app is closed
    fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupId: receiverId, // Using receiverId as target
        senderId: userId,
        title: `Incoming ${type} Call`,
        body: 'Tap to answer',
        url: window.location.href
      })
    }).catch(console.error);

    setCurrentCall({
        id: data.id,
        status: 'ringing',
        type: type,
        caller_id: userId,
        receiver_id: receiverId,
        remotePeerId: `whatsapp_user_${receiverId}`
    });
  };

  const acceptCall = async () => {
    if (!currentCall || !userId) return;
    
    const stream = await startMedia(currentCall.type);
    if (!stream) {
        rejectCall();
        return;
    }

    // Answer the pending peer connection if it came in early
    if (currentConnection.current) {
        currentConnection.current.answer(stream);
        currentConnection.current.on('stream', (remoteStream) => {
            setRemoteStream(remoteStream);
        });
    } else {
        // Wait for peer to call us. We update DB so caller knows we accepted.
        const { error } = await supabase.from('calls').update({ status: 'ongoing' }).eq('id', currentCall.id);
        
        // Let's add a small listener on peer instance for the call event to come shortly after
        if (peerInstance.current) {
            peerInstance.current.on('call', (call) => {
                currentConnection.current = call;
                call.answer(stream);
                call.on('stream', (remStream) => {
                     setRemoteStream(remStream);
                });
            });
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
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  return (
    <CallContext.Provider value={{
        currentCall,
        localStream,
        remoteStream,
        initiateCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleVideo,
        isMuted,
        isVideoOff,
        myUserId: userId
    }}>
      {children}
    </CallContext.Provider>
  );
}

export const useCall = () => {
  const context = useContext(CallContext);
  if (context === undefined) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};
