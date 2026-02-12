"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/config";
import ErrorComponent from "@/components/Error";

import Loader from "@/components/Loader";
export default function Home() {
  const [joinCode, setJoinCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const [recentRoom, addRecentRoom] = useState<string>("");
  const [errorKey, setErrorKey] = useState(0);
  const [error, setError] = useState({ type: "", message: "" });
  useEffect(() => {
    let code = localStorage.getItem("recent-room");
    if (code) {
      addRecentRoom(code);
    }
  }, []);
  function setRecentRoom(code: string) {
    localStorage.setItem("recent-room", code);
  }
  const createRoom = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/rooms`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setRecentRoom(data);
        router.push(`/room/${data}`);
      }
    } catch {
      alert("Failed to create room");
    } finally {
      setIsLoading(false);
    }
  };

  async function joinRoom(room: string) {
    if (!room) return;

    setError({ type: "", message: "" });

    try {
      const res = await fetch(`${API_URL}/api/rooms/viewer?room=${room}`, {
        method: "GET",
      });

      const data = await res.json();

      if (data.exists) {
        router.push(`/room/${room}`);
      } else {
        setError({
          type: "error",
          message: "Sorry that room is closed or was deleted.",
        });
        setErrorKey((k) => k + 1);
        localStorage.removeItem("recent-room");
        setRecentRoom("");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error joining room";

      setError({ type: "error", message });
    }
  }
  if (isLoading) {
    return (
      <div className="w-screen h-screen bg-black justify-center items-center flex">
        <Loader color="white" />
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white tracking-tight">LocalStream</h1>
          <p className="text-neutral-500 mt-2 text-sm">share your screen instantly</p>
          <ErrorComponent key={errorKey} Message={error.message} Type={error.type}></ErrorComponent>
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
            <span className="text-neutral-600 text-xs uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-neutral-800" />
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && joinRoom(joinCode)}
              placeholder="Room code"
              maxLength={6}
              className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-600 transition-colors text-sm tracking-widest"
            />
            <button
              onClick={() => {
                joinRoom(joinCode);
              }}
              disabled={!joinCode.trim()}
              className="bg-neutral-900 border border-neutral-800 text-white px-5 py-3 rounded-lg font-medium hover:bg-neutral-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Join
            </button>
          </div>
          <div className="flex flex-col items-center justify-center border border-white p-2 rounded-md">
            <p className="text-white font-semibold">Recent Rooms</p>
            {recentRoom ? (
              <button
                onClick={() => joinRoom(recentRoom)}
                disabled={!recentRoom}
                className="bg-neutral-900  w-full mt-2 border border-neutral-800 text-white px-5 py-3 rounded-lg font-medium hover:bg-neutral-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {recentRoom}
              </button>
            ) : (
              <p className="text-sm text-gray-500 mt-2"> No recent rooms </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
