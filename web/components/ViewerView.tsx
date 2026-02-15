"use client";
import { useEffect, useRef } from "react";
import { ICE_SERVERS } from "@/lib/config";
import useWebSocketConnection from "@/hooks/useWebSocketConnection";
type StreamError = {
  type: string;
  message: string;
};
type ConnectionState =
  | "initializing"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

interface ViewerViewProps {
  roomCode: string;
  onError: (error: StreamError) => void;
  setConnection: (state: ConnectionState) => void;
}

export default function ViewerView({ roomCode, onError, setConnection }: ViewerViewProps) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const viewerID = useRef(crypto.randomUUID()).current;
  const { sendMessage, connectionState } = useWebSocketConnection({
    roomCode,
    role: "viewer",
    onMessage: handleMessage,
    onError: onError,
    viewerID: viewerID,
  });
  useEffect(() => {
    setConnection(connectionState);
  }, [connectionState]);
  async function handleMessage(event: MessageEvent) {
    const msg = JSON.parse(event.data);
    switch (msg.type) {
      case "offer": {
        await pcRef.current?.setRemoteDescription({ type: "offer", sdp: msg.sdp });
        const ans = await pcRef.current?.createAnswer();
        await pcRef.current?.setLocalDescription(ans);
        sendMessage({ type: "answer", sdp: ans?.sdp });
        break;
      }
      case "streamer-reconnected": {
        onError({ type: "Message", message: "Streamer has reconnected" })
      }
      case "ice-candidate": {
        await pcRef.current?.addIceCandidate(msg.candidate);
        break;
      }
      case "viewer-message": {
        onError({ type: "Message", message: msg.message });
      }
      case "error": {
        onerror?.(msg.message);
        onError({ type: "Error", message: msg.message });
        break;
      }
    }
  }
  useEffect(() => {
    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
    });
    pcRef.current = pc;
    pcRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        sendMessage({ type: "ice-candidate", candidate: event.candidate });
      }
    };

    // attach the video track
    pc.ontrack = (event) => {
      if (videoRef.current) {
        videoRef.current.srcObject = event.streams[0];
      }
    };

    return () => {
      pc.close();
    };
  }, [roomCode]);

  return (
    <div>
      <video ref={videoRef} autoPlay playsInline muted />
    </div>
  );
}
