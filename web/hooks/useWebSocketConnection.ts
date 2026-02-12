import { useEffect, useRef, useState } from "react";
import { WS_URL } from "@/lib/config";

/*
USAGE EXAMPLE:
const { ws, connectionState, sendMessage, reconnect } = useWebSocketConnection({
  roomCode,
  role: "streamer",
  onMessage: handleMessage,
  onError
});
*/

// connection states for StatusDot.tsx
type ConnectionState =
  | "initializing"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

// errors to send to stream
type StreamError = {
  type: string;
  message: string;
};

// props
interface UseWebSocketConnectionProps {
  roomCode: string;
  role: "streamer" | "viewer";
  viewerID?: string;
  onMessage: (event: MessageEvent) => void;
  onError?: (error: StreamError) => void;
}
// return
interface UseWebSocketConnectionReturn {
  ws: WebSocket | null;
  connectionState: ConnectionState;
  reconnect: () => void;
  isReconnecting: boolean;
  sendMessage: (data: any) => void;
}

const useWebSocketConnection = (
  props: UseWebSocketConnectionProps,
): UseWebSocketConnectionReturn => {
  // states
    const wsRef = useRef<WebSocket | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("initializing");
  const [isReconnecting, setIsReconnecting] = useState(false);
  const reconnecting = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const omRef = useRef(props.onMessage);
  const manualCloseRef = useRef(false);

  // in case of disconnect, try to attempt, but after 3 times show error
  const attemptReconnection = () => {
    if (reconnecting.current >= 3) {
      setConnectionState("error");
      return;
    }

    reconnecting.current += 1;
    setConnectionState("reconnecting");
    setIsReconnecting(true);
    createWebsocketConnection();
  };

  // handle when the Websocket opens
  const handleOpen = () => {
    setConnectionState("connected");
    setIsReconnecting(false);
    reconnecting.current = 0;
  };
  // handle when the Websocket closes
  const handleClose = () => {
    if (manualCloseRef.current) {
      setConnectionState("disconnected");
      return; // manual close protection
    }
    setConnectionState("disconnected");
    const delay = getReconnectDelay(reconnecting.current);
    scheduleReconnect(delay);
  };
  // handle Websocket error
  const handleError = () => {
    setConnectionState("error");
    props.onError?.({ type: "error", message: "Connection error" });
  };
  const getReconnectDelay = (attempt: number): number => {
    const delays = [1000, 3000, 5000];
    return delays[Math.min(attempt, delays.length - 1)];
  };

  // create a new Websocket connection
  const createWebsocketConnection = () => {
    manualCloseRef.current = false; // reset manual close ref
    wsRef.current?.close();
    setConnectionState("connecting");
    let wsUrl: string;
    if (props.role === "viewer") {
      if (!props.viewerID) return;
      wsUrl = `${WS_URL}/ws?role=viewer&room=${props.roomCode}&viewerID=${props.viewerID}`;
    } else {
      wsUrl = `${WS_URL}/ws?role=streamer&room=${props.roomCode}`;
    }
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onopen = handleOpen;
    ws.onclose = handleClose;
    ws.onerror = handleError;
    ws.onmessage = omRef.current;
  };
  // schedules reconnect after given delay
  const scheduleReconnect = (delay: number) => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    // schedule new reconnection attempt
    reconnectTimeoutRef.current = setTimeout(() => {
      attemptReconnection();
    }, delay);
  };
  // everytime onMessage changes, update it's ref
  useEffect(() => {
    omRef.current = props.onMessage;
  }, [props.onMessage]);
  
  // create a new connection
  useEffect(() => {
    createWebsocketConnection();
    return () => {
      manualCloseRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
    };
  }, [props.roomCode, props.role, props.viewerID]);
  
  return {
    ws: wsRef.current,
    connectionState: connectionState,
    reconnect: () => attemptReconnection(),
    isReconnecting: isReconnecting,
    sendMessage: (data) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(data));
      }
    },
  };
};

export default useWebSocketConnection;
