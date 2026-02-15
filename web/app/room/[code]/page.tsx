"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import StreamerView from "@/components/StreamerView";
import ViewerView from "@/components/ViewerView";
import ErrorComponent from "@/components/Error";
import { ConnectionStatusBadge } from "@/components/StatusDot";
import { RoomClosureModal } from "@/components/RoomClosureModal";
import { API_URL } from "@/lib/config";
type StreamError = {
  type: string;
  message: string;
};
type ConnectionState =
  | "initializing"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = params.code as string;
  const [role, setRole] = useState<"streamer" | "viewer" | null>(null);
  const [streamError, setstreamError] = useState<StreamError>({ type: "", message: "" });
  const [roomExists, setRoomExists] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>("initializing");
  const [roomClosing, setRoomClosing] = useState(false);
  const [streamerReconnected, setStreamerReconnected] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch(`${API_URL}/api/rooms/viewer?room=${roomCode}`, {
        method: "GET",
      });
      const data = await res.json();
      if (data.exists) {
        setRoomExists(true);
      }
    };
    if (roomCode) {
      fetchData();
    }
  }, []);
  useEffect(() => {
    if (connectionState === "connected") {
      setRoomClosing(false);
    }
  }, [connectionState]);

  function handleError(e: StreamError) {
    setstreamError({ type: "", message: "" });
    if (e.message.includes("Streamer has left, room will be closed in 30 seconds.")) {
      setRoomClosing(true);
    }
    if(e.message.includes("Streamer has reconnected")){
      setRoomClosing(false);
      localStorage.removeItem("roomExpiresAt")
    }
    setstreamError(e);
  }

  function setState(state: ConnectionState) {
    setConnectionState(state);

    if (role === "streamer" && state === "connected" && roomClosing) {
      console.log("Streamer reconnected, stopping countdown");
      setStreamerReconnected(true);
      setstreamError({ type: "", message: "" });
    }
  }

  if (!roomExists) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-10">
            <button
              onClick={() => router.push(`/`)}
              className="text-neutral-600 hover:text-white transition-colors text-lg mb-6 inline-block cursor-pointer"
            >
              &larr; back
            </button>

            <p className="text-lg text-white font-bold">
              Sorry the room does not exist or may have been closed.
            </p>
          </div>
        </div>
      </div>
    );
  }
  if (!role && roomExists) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-10">
            <button
              onClick={() => router.push(`/`)}
              className="text-neutral-600 hover:text-white transition-colors text-lg mb-6 inline-block cursor-pointer"
            >
              &larr; back
            </button>

            <h1 className="text-2xl font-bold text-white tracking-tight">{roomCode}</h1>
            <p className="text-neutral-500 mt-2 text-sm">choose your role</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setRole("streamer")}
              className="w-full bg-white text-black py-3 px-6 rounded-lg font-medium hover:bg-neutral-200 transition-colors cursor-pointer"
            >
              Stream
            </button>
            <button
              onClick={() => setRole("viewer")}
              className="w-full bg-neutral-900 border border-neutral-800 text-white py-3 px-6 rounded-lg font-medium hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Watch
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="flex items-baseline gap-3 px-4 py-3 border-b border-neutral-800">
        <button
          onClick={() => setRole(null)}
          className="text-neutral-600 hover:text-white transition-colors text-sm  inline-block cursor-pointer"
        >
          &larr; back
        </button>
        <span className="text-white text-md font-medium tracking-wide">{roomCode}</span>
        <span className="text-neutral-600 text-md">
          {role === "streamer" ? "streaming" : "watching"}
        </span>
        <ConnectionStatusBadge details={connectionState} />
      </div>
      <div className="w-full flex justify-end z-10 fixed">
        {streamError.message ? (
          <ErrorComponent Message={streamError.message} Type={streamError.type} />
        ) : (
          ""
        )}
      </div>
      {roomClosing && (
        <RoomClosureModal
          roomCode={roomCode}
          streamerReconnected={streamerReconnected}
          onStreamerReconnected={() => {
            setRoomClosing(false);
            setStreamerReconnected(false);
            setstreamError({ type: "", message: "" });
          }}
        />
      )}
      <div className={`p-4 ${roomClosing ? "hidden" : ""}`}>
        {role === "streamer" ? (
          <StreamerView roomCode={roomCode} onError={handleError} setConnection={setState} />
        ) : (
          <ViewerView roomCode={roomCode} onError={handleError} setConnection={setState} />
        )}
      </div>
    </div>
  );
}
