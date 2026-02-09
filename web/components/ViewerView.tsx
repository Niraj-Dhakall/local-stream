"use client";
import { useEffect, useRef } from "react";
import { WS_URL, ICE_SERVERS } from "@/lib/config";
type StreamError = {
    type: string, 
    message: string
}
interface ViewerViewProps{
    roomCode: string;
    onError: (error: StreamError) => void;
}
export default function ViewerView({roomCode, onError}: ViewerViewProps){
    const wsRef = useRef<WebSocket | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    useEffect(() =>{
        const viewerID = crypto.randomUUID();
        const ws = new WebSocket(`${WS_URL}/ws?role=viewer&room=${roomCode}&viewerID=${viewerID}`)
        wsRef.current = ws
        const pc = new RTCPeerConnection({
            iceServers: ICE_SERVERS,
        })
        pcRef.current = pc
        pcRef.current.onicecandidate = (event) =>{
            if(event.candidate && wsRef.current?.readyState === WebSocket.OPEN){
                wsRef.current.send(JSON.stringify({type: "ice-candidate", candidate: event.candidate}))
            }
        }

        // attach the video track
        pc.ontrack = (event) =>{
            if(videoRef.current){
                videoRef.current.srcObject = event.streams[0]
            }
        }

        wsRef.current.onmessage = async (event) => {
            const msg = JSON.parse(event.data);
            switch (msg.type){
                case "offer": {
                    await pcRef.current?.setRemoteDescription({type: "offer", sdp: msg.sdp })
                    const ans = await pcRef.current?.createAnswer()
                    await pcRef.current?.setLocalDescription(ans)
                    wsRef.current?.send(JSON.stringify({type: "answer", sdp: ans?.sdp}))
                    break
                }
                case "ice-candidate": {
                    await pcRef.current?.addIceCandidate(msg.candidate)
                    break
                }
                case "viewer-message": {
                    error = {type: "Message", message: msg.message}
                }
                
            }
        }
        return () => {
    pc.close();
    ws.close();
};
        
    }, [roomCode])


    return (
        <div>
            <video ref={videoRef} autoPlay playsInline muted />
        </div>
    );
}