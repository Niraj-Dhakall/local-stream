"use client";
import { useEffect, useRef, useState } from "react";

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

interface StreamerViewProps {
  roomCode: string;
  onError: (error: StreamError) => void;
  setConnection: (state: ConnectionState) => void;
}

export default function StreamerView({ roomCode, onError, setConnection }: StreamerViewProps) {
  const { sendMessage, connectionState } = useWebSocketConnection({
    roomCode,
    role: "streamer",
    onMessage: handleMessage,
    onError: onError,
  });
  const pcRef = useRef<Map<string, RTCPeerConnection>>(new Map()); // peer connections
  const streamRef = useRef<MediaStream | null>(null); // screen capture
  const videoRef = useRef<HTMLVideoElement | null>(null); // video reference (lowkey i might remove this)
  const q = useRef<string[]>([]); // queue of viewers before screen capture
  const [hideStream, setHideStream] = useState(false);
  useEffect(() => {
    setConnection(connectionState);
  }, [connectionState]);
  async function handleMessage(event: MessageEvent) {
    const msg = JSON.parse(event.data);
    switch (msg.type) {
      case "new-viewer": {
        onError({ type: "Message", message: `New viewer joined: ${msg.viewerID}` });
        createPeerForViewer(msg.viewerID);
        break;
      }
      case "error":
        onerror?.(msg.message);
        onError({ type: "Error", message: msg.message });
        break;
      case "answer": {
        const pc = pcRef.current.get(msg.viewerID);
        pc?.setRemoteDescription({ type: "answer", sdp: msg.sdp });
        break;
      }
      case "ice-candidate": {
        const pc = pcRef.current.get(msg.viewerID);
        pc?.addIceCandidate(msg.candidate);
        break;
      }
      case "viewer-left": {
        const pc = pcRef.current.get(msg.viewerID);
        pc?.close();
        pcRef.current.delete(msg.viewerID);
        break;
      }
    }
  }
  useEffect(() => {
    return () => {
      pcRef.current.forEach((pc) => pc.close());
      pcRef.current.clear();
    };
  }, []);

  // create a new peer connection for viewers
  async function createPeerForViewer(viewerID: string) {
    // for early viewers just add them to the queue
    if (!streamRef.current) {
      q.current.push(viewerID);
      return;
    }
    // create new connection
    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
    });
    pcRef.current.set(viewerID, pc);
    // add the tracks
    const tracks = streamRef.current?.getTracks();

    tracks?.forEach((track) => {
      pc.addTrack(track, streamRef.current!);
    });

    // ice canidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendMessage({ type: "ice-candidate", viewerID: viewerID, candidate: event.candidate });
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendMessage({ type: "offer", viewerID: viewerID, sdp: offer.sdp });
  }
  useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        // for early viewers
        q.current.forEach(createPeerForViewer);
        q.current = [];
      } catch (error) {
        let message = "Unknown error";
        error instanceof Error ? (message = error.message) : (message = "Error recording");
        console.log(message);
      }
    })();
  }, []);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setHideStream(!hideStream)}
          className="bg-neutral-900 border border-neutral-800 text-white px-4 py-2 rounded-lg font-medium hover:bg-neutral-800 transition-colors"
        >
          {hideStream ? "Show Video" : "Hide Video"}
        </button>
        <span className="text-neutral-400 text-sm">Preview of your shared screen</span>
      </div>

      {!hideStream && (
        <div className="w-full max-w-2xl">
          <video ref={videoRef} autoPlay playsInline muted />
        </div>
      )}
    </div>
  );
}
