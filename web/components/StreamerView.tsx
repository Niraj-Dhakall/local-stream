"use client";
import { useEffect, useRef } from "react";

import { WS_URL, ICE_SERVERS } from "@/lib/config";
type StreamError = {
    type: string, 
    message: string
}
interface StreamerViewProps{
    roomCode: string;
    onError: (error: StreamError) => void;
}

export default function StreamerView({roomCode, onError}: StreamerViewProps){
    const pcRef = useRef<Map<string, RTCPeerConnection>>(new Map()); // peer connections
    const wsRef = useRef<WebSocket | null>(null); // signaling channel
    const streamRef = useRef<MediaStream | null>(null); // screen capture
    const videoRef = useRef<HTMLVideoElement | null>(null); // video reference (lowkey i might remove this)
    const q = useRef<string[]>([]); // queue of viewers before screen capture
    
    async function handleMessage(event: MessageEvent){
        const msg = JSON.parse(event.data);
        switch(msg.type){
            case "new-viewer":{
                onError({type: "Message", message: msg.message})
                createPeerForViewer(msg.viewerID)
                break
            }
            case "error":
                onerror?.(msg.message);
                onError ({type: "Error", message: msg.message})
                wsRef.current?.close();
                break;
            case "answer":{
                const pc = pcRef.current.get(msg.viewerID)
                pc?.setRemoteDescription({type: "answer", sdp: msg.sdp})
                break
            }
            case 'ice-candidate': {
                const pc = pcRef.current.get(msg.viewerID)
                pc?.addIceCandidate(msg.candidate)
                break
            }
            case 'viewer-left': {
                const pc = pcRef.current.get(msg.viewerID)
                pc?.close()
                pcRef.current.delete(msg.viewerID)
                break
            }
        
        }

    }
    useEffect(() =>{ 
        const ws = new WebSocket(`${WS_URL}/ws?role=streamer&room=${roomCode}`)
        wsRef.current = ws;
        ws.onmessage = handleMessage;
        return () => {
            pcRef.current.forEach(pc => pc.close());
            pcRef.current.clear();
            ws.close();
        };
    }, [roomCode])

    // create a new peer connection for viewers
    async function createPeerForViewer(viewerID: string){
        // for early viewers just add them to the queue
        if(!streamRef.current){
            q.current.push(viewerID)
            return;
        }
        // create new connection
        const pc = new RTCPeerConnection({
            iceServers: ICE_SERVERS,
        })
        pcRef.current.set(viewerID, pc)
        // add the tracks
        const tracks = streamRef.current?.getTracks()

        tracks?.forEach(track => {
            pc.addTrack(track, streamRef.current!)
        })

        // ice canidates
        pc.onicecandidate = (event) => {
            if(event.candidate && wsRef.current?.readyState === WebSocket.OPEN){
                wsRef.current.send(JSON.stringify({type: "ice-candidate", "viewerID": viewerID, candidate: event.candidate}))
            }
        }

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        wsRef.current?.send(JSON.stringify({type: "offer", "viewerID": viewerID, sdp: offer.sdp}))
    }
    useEffect(() =>{
      (async () => {
        try{
            const stream = await navigator.mediaDevices.getDisplayMedia({
              video: true,
              audio: false,
          })
          
          streamRef.current = stream
          if(videoRef.current){
              videoRef.current.srcObject = stream
          }
          // for early viewers
          q.current.forEach(createPeerForViewer)
          q.current = []
        }catch(error){
              let message = "Unknown error"
              error instanceof Error ? message = error.message : message = "Error recording"
        }
      })()
    }, [])
    return(
        <div>
            <video ref={videoRef} autoPlay playsInline muted />
        </div>
    );
}