"use client";
import { useState, useEffect } from "react";

interface ErrorProps {
  Type: string;
  Message: string;
  duration?: number;
}

export default function ErrorComponent({ Type, Message, duration = 5000 }: ErrorProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(true);

  const isSuccess = Type === "Message";

  useEffect(() => {
    if (!Message) {
      setShouldRender(false);
      return;
    }
    setShouldRender(true);
    const showTimer = setTimeout(() => setIsVisible(true), 10);
    const hideTimer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => setShouldRender(false), 300);
    }, duration);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [Message, duration]);

  if (!shouldRender || !Message) {
    return null;
  }

  return (
    <div
      className={`
        flex items-center gap-3 p-4 mt-4
        max-w-xl w-full
        border-2 rounded-lg
        transition-all duration-300 ease-out
        ${isSuccess ? "bg-white border-black" : "bg-black border-white"}
        ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
      `}
      role="alert"
    >
      <div className="shrink-0">
        {isSuccess ? (
          <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        )}
      </div>

      <div className="flex-1">
        <p className={`font-semibold text-sm mb-1 ${isSuccess ? "text-black" : "text-white"}`}>
          {isSuccess ? "Success" : "Error"}
        </p>
        <p className={`text-sm ${isSuccess ? "text-gray-700" : "text-gray-300"}`}>{Message}</p>
      </div>

      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(() => setShouldRender(false), 300);
        }}
        className={`
          shrink-0 p-1 rounded-md
          transition-colors duration-200
          ${isSuccess ? "hover:bg-gray-100 text-gray-500" : "hover:bg-gray-800 text-gray-400"}
        `}
        aria-label="Dismiss"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}
