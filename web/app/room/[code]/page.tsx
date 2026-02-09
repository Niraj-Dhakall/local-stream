"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import StreamerView from "@/components/StreamerView";
import ViewerView from "@/components/ViewerView";
import ErrorComponent from "@/components/Error";
type StreamError = {
    type: string,
    message: string
}
export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = params.code as string;
  const [role, setRole] = useState<"streamer" | "viewer" | null>(null);
  const [streamerError, setstreamerError] = useState<StreamError>({type: "", message: ""})

  function handleError(e : StreamError){
    setstreamerError(e);
  }
  if (!role) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-10">
            <button
              onClick={() => router.push("/")}
              className="text-neutral-600 hover:text-white transition-colors text-sm mb-6 inline-block cursor-pointer"
            >
              &larr; back
            </button>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {roomCode}
            </h1>
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
      <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <button
          onClick={() => router.push("/")}
          className="text-neutral-600 hover:text-white transition-colors text-md cursor-pointer"
        >
          &larr;
        </button>
        <span className="text-white text-md font-medium tracking-wide">
          {roomCode}
        </span>
        <span className="text-neutral-600 text-md">
          {role === "streamer" ? "streaming" : "watching"}
        </span>
        {streamerError? <ErrorComponent Message={streamerError.message} Type={streamerError.type}/> : ""}
      </div>

      <div className="p-4">
        {role === "streamer" ? (
          <StreamerView roomCode={roomCode} onError={handleError} />
        ) : (
          <ViewerView roomCode={roomCode} onError={handleError} />
        )}
      </div>
    </div>
  );
}