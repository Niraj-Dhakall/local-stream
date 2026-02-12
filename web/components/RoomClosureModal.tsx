"use client";

import useCountdown from "@/hooks/useCountdown";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function RoomClosureModal() {
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
        router.push("/");
        return;
      }
      setExpiresAt(expiresAtInt);
    }
  }, [router]);

  const { seconds } = useCountdown({
    autoStart: true,
    onComplete: handleComplete,
    expiresAt: expiresAt || Date.now() + 30000,
  });

  function handleComplete() {
    localStorage.removeItem("roomExpiresAt");
    router.push("/");
  }

  if (!expiresAt) {
    return null;
  }

  return (
    <div className="w-full h-screen bg-black/90 flex items-center justify-center">
      <div className="p-4 flex flex-col border text-center text-3xl border-gray-400 w-fit h-fit rounded-lg">
        <p className="text-white font-bold mb-2">Room closing in</p>
        <span className="text-white">
          <span className={`text-${seconds <= 10 ? "red-400" : "white"} font-bold text-4xl`}>
            {seconds}
          </span>
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
