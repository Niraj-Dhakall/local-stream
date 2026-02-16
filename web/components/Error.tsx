"use client";
import { useState, useEffect, useRef } from "react";

type NotificationType = "success" | "info" | "warning" | "error";

interface ErrorProps {
  Type: string;
  Message: string;
  duration?: number;
}

const typeConfig: Record<NotificationType, { border: string; label: string; duration: number }> = {
  success: { border: "#10b981", label: "Success", duration: 5000 },
  info: { border: "#3b82f6", label: "Info", duration: 5000 },
  warning: { border: "#f59e0b", label: "Warning", duration: 10000 },
  error: { border: "#ef4444", label: "Error", duration: 30000 },
};

function resolveType(raw: string): NotificationType {
  const lower = raw.toLowerCase();
  if (lower === "message" || lower === "success") return "success";
  if (lower === "info") return "info";
  if (lower === "warning") return "warning";
  return "error";
}

function Icon({ type }: { type: NotificationType }) {
  const props = { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24" };
  const pathProps = { strokeLinecap: "round" as const, strokeLinejoin: "round" as const, strokeWidth: 2 };

  switch (type) {
    case "success":
      return <svg {...props}><path {...pathProps} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    case "info":
      return <svg {...props}><path {...pathProps} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    case "warning":
      return <svg {...props}><path {...pathProps} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>;
    case "error":
      return <svg {...props}><path {...pathProps} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
  }
}

export default function ErrorComponent({ Type, Message, duration }: ErrorProps) {
  const [phase, setPhase] = useState<"enter" | "visible" | "exit" | "gone">("enter");
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const startRef = useRef(0);
  const progressRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>();

  const resolved = resolveType(Type);
  const config = typeConfig[resolved];
  const effectiveDuration = duration ?? config.duration;

  useEffect(() => {
    if (!Message) { setPhase("gone"); return; }

    setPhase("enter");
    const enterTimer = setTimeout(() => setPhase("visible"), 20);

    startRef.current = Date.now();
    timerRef.current = setTimeout(() => setPhase("exit"), effectiveDuration);

    const tick = () => {
      if (progressRef.current) {
        const elapsed = Date.now() - startRef.current;
        const pct = Math.max(0, 1 - elapsed / effectiveDuration);
        progressRef.current.style.transform = `scaleX(${pct})`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [Message, effectiveDuration]);

  useEffect(() => {
    if (phase === "exit") {
      const t = setTimeout(() => setPhase("gone"), 300);
      return () => clearTimeout(t);
    }
  }, [phase]);

  if (phase === "gone" || !Message) return null;

  const dismiss = () => {
    clearTimeout(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setPhase("exit");
  };

  const isVisible = phase === "visible";

  return (
    <div
      style={{ borderLeftColor: config.border, borderLeftWidth: 4 }}
      className={`
        flex items-center gap-3 p-4 mt-4
        max-w-xl w-full
        bg-neutral-900 border border-neutral-700 rounded-lg
        transition-all duration-300 ease-out relative overflow-hidden
        ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3"}
      `}
      role="alert"
    >
      <div className="shrink-0" style={{ color: config.border }}>
        <Icon type={resolved} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-white">{config.label}</p>
        <p className="text-sm text-neutral-300 wrap-break-word">{Message}</p>
      </div>

      <button
        onClick={dismiss}
        className="shrink-0 p-1 rounded-md transition-colors duration-200 hover:bg-neutral-700 text-neutral-400"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div
        ref={progressRef}
        className="absolute bottom-0 left-0 h-0.5 w-full origin-left"
        style={{ backgroundColor: config.border, transform: "scaleX(1)" }}
      />
    </div>
  );
}
