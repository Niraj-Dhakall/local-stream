"use client";

import { useEffect, useRef, useState } from "react";

const SIGNAL_SERVER = "ws://localhost:8080";

interface Props {
  role: "streamer" | "viewer";
}

export default function Streamer({ role }: Props) {
  // refs and states
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<string>("connecting");
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // new websocket connection
    const ws = new WebSocket(`${SIGNAL_SERVER}/ws?role=${role}`);
    wsRef.current = ws;
    // webrtc connection
    const rtc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun.l.google.com:5349" },
        // { urls: "stun:stun1.l.google.com:3478" },
        // { urls: "stun:stun1.l.google.com:5349" },
        // { urls: "stun:stun2.l.google.com:19302" },
        // { urls: "stun:stun2.l.google.com:5349" },
        // { urls: "stun:stun3.l.google.com:3478" },
        // { urls: "stun:stun3.l.google.com:5349" },
        // { urls: "stun:stun4.l.google.com:19302" },
        // { urls: "stun:stun4.l.google.com:5349" }
      ],
    });
    pcRef.current = rtc;
    // new ice canidate found
    rtc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ice-candidate", candidate: event.candidate }));
      }
    };
    if (role === "viewer") {
      // video ref for the viewer so they can see the stream
      rtc.ontrack = (e) => {
        if (videoRef.current) {
          videoRef.current.srcObject = e.streams[0];
        }
      };
    }
    ws.onopen = async function () {
      setStatus("connected to signaling server");
      if (role !== "streamer") {
        return;
      }
      try {
        // ask for permission to share window
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
        // set the video ref to the stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        // add the tracks to rtc
        stream.getTracks().forEach((track) => {
          rtc.addTrack(track, stream);
        });
        // create rtc offer as streamer and send it
        const offer = await rtc.createOffer();
        await rtc.setLocalDescription(offer);
        ws.send(JSON.stringify({ type: "offer", sdp: offer.sdp }));
      } catch (error) {
        let message = "Unknown error";
        error instanceof Error ? (message = error.message) : (message = "Error recording");
        setStatus(message);
      }
    };

    ws.onmessage = async function (event) {
      const msg = JSON.parse(event.data);
      // if the message is an offer, set remote desicription to it and give an answer
      if (msg.type === "offer") {
        await rtc.setRemoteDescription({ type: "offer", sdp: msg.sdp });
        const ans = await rtc.createAnswer();
        await rtc.setLocalDescription(ans);
        ws.send(JSON.stringify({ type: "answer", sdp: ans.sdp }));
      }
      if (msg.type === "answer") {
        // if the message is an answer, set the remote description to it
        await rtc.setRemoteDescription({ type: "answer", sdp: msg.sdp });
      }
      // if the message is an ice candidate, then add that to the candidates
      if (msg.type === "ice-candidate") {
        await rtc.addIceCandidate(msg.candidate);
      }
    };
    // close web socket and rtc
    return () => {
      ws.close();
      rtc.close();
    };
  }, [role]);
  return (
    <div>
      <p className="status">
        {role === "streamer" ? "Streamer" : "Viewer"} — {status}
      </p>
      <video ref={videoRef} autoPlay playsInline muted={role === "streamer"} />
    </div>
  );
}
