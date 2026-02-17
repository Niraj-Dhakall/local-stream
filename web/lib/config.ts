function getBaseUrls() {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const isSecure = window.location.protocol === "https:";
    return {
      ws: `${isSecure ? "wss" : "ws"}://${host}:8080`,
      api: `${isSecure ? "https" : "http"}://${host}:8080`,
    };
  }
  return {
    ws: process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080",
    api: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080",
  };
}

export const WS_URL = getBaseUrls().ws;
export const API_URL = getBaseUrls().api;
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun.l.google.com:5349" },
  ...(process.env.NEXT_PUBLIC_TURN_URL ? [{
    urls: process.env.NEXT_PUBLIC_TURN_URL,
    username: process.env.NEXT_PUBLIC_TURN_USERNAME || "",
    credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || "",
  }] : []),
];
