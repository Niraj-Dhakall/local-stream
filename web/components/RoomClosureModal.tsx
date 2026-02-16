"use client";

import useCountdown from "@/hooks/useCountdown";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { API_URL } from "@/lib/config";

interface RoomClosureModalProps {
  roomCode: string;
  streamerReconnected?: boolean;
  onStreamerReconnected?: () => void;
}

export function RoomClosureModal({ roomCode, streamerReconnected, onStreamerReconnected }: RoomClosureModalProps) {
  const router = useRouter();
  const [expiresAt, setExpiresAt] = useState<number | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("roomExpiresAt");
    if (!stored) {
      const newExpiresAt = Date.now() + 30 * 1000;
      localStorage.setItem("roomExpiresAt", newExpiresAt.toString());
      setExpiresAt(newExpiresAt);
    } else {
      const expiresAtInt = parseInt(stored);
      if (expiresAtInt <= Date.now()) {
        localStorage.removeItem("roomExpiresAt");
        return;
      }
      setExpiresAt(expiresAtInt);
    }
  }, [router]);

  const { seconds, pause } = useCountdown({
    autoStart: true,
    onComplete: handleComplete,
    expiresAt: expiresAt || Date.now() + 30000,
  });

  useEffect(() => {
    if (streamerReconnected) {
      pause();
      localStorage.removeItem("roomExpiresAt");
      onStreamerReconnected?.();
    }
  }, [streamerReconnected, onStreamerReconnected, pause]);

  async function handleComplete() {
    try {
      await fetch(`${API_URL}/api/rooms/del?room=${roomCode}`, { method: "DELETE" });
    } catch (error) {
      console.error("Failed to close room:", error);
    }
    localStorage.removeItem("roomExpiresAt");
    localStorage.removeItem("recent-room")
    router.push("/");
  }

  if (!expiresAt) {
    return null;
  }

  return (
    <div className="w-full h-screen bg-black/90 flex items-center justify-center">
      <div className="p-4 flex flex-col border text-center text-3xl border-gray-400 w-fit h-fit rounded-lg">
        <p className="text-white font-bold mb-2">Room closing in</p>
        <span className={`${seconds <= 10 ? "text-red-500" : "text-white"} font-bold text-4xl`}>
          {seconds}
        </span>
        <button
          onClick={() => router.push("/")}
          className="text-black bg-white p-3 rounded font-bold text-sm cursor-pointer mt-2"
        >
          Leave
        </button>
      </div>
    </div>
  );
}
