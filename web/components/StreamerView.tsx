"use client";
import { useEffect, useRef, useState } from "react";
import { API_URL } from "@/lib/config";
import { ICE_SERVERS } from "@/lib/config";
import useWebSocketConnection from "@/hooks/useWebSocketConnection";
import { Dot } from "lucide-react";
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
  setViewerCount: (count: number) => void;
}

export default function StreamerView({ roomCode, onError, setConnection, setViewerCount }: StreamerViewProps) {
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
  const [hasStreamer, setHasStreamer] = useState<boolean | null>(null);
  const [startTime] = useState(Date.now());
  const [elaspedTime, setElaspedTime] = useState(0);
  const [isSharing, setIsSharing] = useState(false)
  useEffect(() =>{
    const iID = setInterval(() => {
      setElaspedTime(Date.now() - startTime)
    }, 1000 )
    

    return () => clearInterval(iID);
  }, [startTime])
  const formatTime = (milliseconds : number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    async function fetchStreamer() {
      const res = await fetch(`${API_URL}/api/rooms/streamer?room=${roomCode}`, {
        method: "GET",
      });
      const data = await res.json();
      if (res.ok) {
        setHasStreamer(data.hasStreamer);
      } else {
        setHasStreamer(false);
      }
    }
    fetchStreamer();
  }, []);

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
      case "error":{
        onError({ type: "Error", message: msg.message });
        break;
      }
      case"streamer-message": {
        onError({ type: "Message", message: msg.message });
        break;

      }
    
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
      case "viewer-count": {
        setViewerCount(msg.count)
        break;
      }
    }
  }

  useEffect(() => {
    return () => {
      pcRef.current.forEach((pc) => pc.close());
      pcRef.current.clear();
      
      streamRef.current?.getTracks().forEach((track) => track.stop());
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
  async function startScreenShare() {
     try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
        stream.getVideoTracks()[0].onended = () => {
          setIsSharing(false);
          streamRef.current = null;
        };
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setIsSharing(true);
        // for early viewers
        q.current.forEach(createPeerForViewer);
        q.current = [];
      } catch (error) {
        let message = "Unknown error";
        error instanceof Error ? (message = error.message) : (message = "Error recording");
        onError({ type: "Error", message });
      }
  }
  useEffect(() => {
    if (hasStreamer === null) return;

    if (hasStreamer) {
      onError({ type: "Error", message: "There is already a streamer in this room" });
      return;
    }

    (async () => {
     startScreenShare();
    })();
  }, [hasStreamer]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setHideStream(!hideStream)}
          className="bg-neutral-900 border border-neutral-800 text-white px-4 py-2 rounded-lg font-medium hover:bg-neutral-800 transition-colors"
        >
          {hideStream ? "Show Video" : "Hide Video"}
        </button>

        <button
        onClick={()=>startScreenShare()}
        className={`${isSharing ? "hidden": ""} bg-neutral-900 border border-neutral-800 text-white px-4 py-2 rounded-lg font-medium hover:bg-neutral-800 transition-colors`}
        >
        Share Screen
        </button>
        <span className="text-neutral-400 text-sm">Preview of your shared screen</span>
        <div>
          <span className="flex text-neutral-500 items-center"><Dot className="text-red-500 animate-pulse h-7 w-7"/>{formatTime(elaspedTime)}</span>
        </div>
      </div>
      
      <div className={`w-full max-w-2xl ${hideStream ? "hidden" : ""}`}>
        <video ref={videoRef} autoPlay playsInline muted />
      </div>
    </div>
  );
}
