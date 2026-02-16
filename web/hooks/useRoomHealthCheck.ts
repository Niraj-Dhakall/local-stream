import { useEffect, useRef, useState } from "react";
import { API_URL } from "@/lib/config";
interface UseRoomHealthCheckOptions {
  roomCode: string;
  wsConnected: boolean;
  onRoomMissing?: () => void;
  intervalMs?: number;
}

export function useRoomHealthCheck({
  roomCode,
  wsConnected,
  onRoomMissing,
  intervalMs = 10000,
}: UseRoomHealthCheckOptions) {
  const [roomExists, setRoomExists] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const checkingRef = useRef(false);
  const hasTriggeredRef = useRef(false)

  async function checkRoom() {
    if (checkingRef.current) {
      return;
    }
    checkingRef.current = true;
    setIsChecking(true);
    try {
      const res = await fetch(`${API_URL}/api/rooms/viewer?room=${roomCode}`, {
        method: "GET",
      });

      const data = await res.json();
      const exist = data.exists === true;
      setRoomExists(exist);
      setLastChecked(new Date());

      if (!exist && !hasTriggeredRef.current && onRoomMissing) {
        hasTriggeredRef.current = true;
        onRoomMissing();
      }
    } catch (error) {
      console.error("Room polling failed:", error);
    } finally {
      checkingRef.current = false;
      setIsChecking(false);
    }
  }
  useEffect(() => {
    if (!wsConnected) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    checkRoom();
    intervalRef.current = setInterval(checkRoom, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [wsConnected, roomCode]);

  return { roomExists, isChecking, lastChecked };
}
