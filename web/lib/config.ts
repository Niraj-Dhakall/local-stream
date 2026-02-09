export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080";
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun.l.google.com:5349" },
  ...(process.env.NEXT_PUBLIC_TURN_URL ? [{
    urls: process.env.NEXT_PUBLIC_TURN_URL,
    username: process.env.NEXT_PUBLIC_TURN_USERNAME || "",
    credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || "",
  }] : []),
];