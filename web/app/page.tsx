"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/config";

export default function Home() {
  const [joinCode, setJoinCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const createRoom = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/rooms`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        router.push(`/room/${data}`);
      }
    } catch {
      alert("Failed to create room");
    } finally {
      setIsLoading(false);
    }
  };

  const joinRoom = () => {
    if (joinCode.trim()) {
      router.push(`/room/${joinCode.trim()}`);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white tracking-tight">
            LocalStream
          </h1>
          <p className="text-neutral-500 mt-2 text-sm">
            share your screen instantly
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={createRoom}
            disabled={isLoading}
            className="w-full bg-white text-black py-3 px-6 rounded-lg font-medium hover:bg-neutral-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? "Creating..." : "Create Room"}
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-neutral-800" />
            <span className="text-neutral-600 text-xs uppercase tracking-widest">
              or
            </span>
            <div className="flex-1 h-px bg-neutral-800" />
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && joinRoom()}
              placeholder="Room code"
              maxLength={6}
              className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-600 transition-colors text-sm tracking-widest"
            />
            <button
              onClick={joinRoom}
              disabled={!joinCode.trim()}
              className="bg-neutral-900 border border-neutral-800 text-white px-5 py-3 rounded-lg font-medium hover:bg-neutral-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Join
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}