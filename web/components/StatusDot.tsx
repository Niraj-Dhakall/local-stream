import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
type ConnectionState =
  | "initializing"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

interface ConnectionDetails {
  websocketState: ConnectionState;
  rtcState?: string;
  connectedAt?: Date;
  latencyMs?: number;
}
interface ConnectionStatusBadgeProps {
  details: ConnectionState;
  className?: string;
}

const STATUS_CONFIG: Record<
  ConnectionState,
  { label: string; color: "green" | "yellow" | "red"; pulse: boolean }
> = {
  connected: { label: "Connected", color: "green", pulse: false },
  connecting: { label: "Connecting…", color: "yellow", pulse: true },
  reconnecting: { label: "Reconnecting…", color: "yellow", pulse: true },
  initializing: { label: "Initializing…", color: "yellow", pulse: true },
  disconnected: { label: "Disconnected", color: "red", pulse: false },
  error: { label: "Error", color: "red", pulse: false },
};

const DOT_COLORS = {
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  red: "bg-red-500",
} as const;

const BADGE_COLORS = {
  green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  yellow: "border-amber-400/30 bg-amber-400/10 text-amber-700 dark:text-amber-400",
  red: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
} as const;



export function ConnectionStatusBadge({ details, className }: ConnectionStatusBadgeProps) {
  const config = STATUS_CONFIG[details];



  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-300",
            BADGE_COLORS[config.color],
            className,
          )}
        >
          <span className="relative flex h-2 w-2">
            {config.pulse && (
              <span
                className={cn(
                  "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                  DOT_COLORS[config.color],
                )}
              />
            )}
            <span
              className={cn("relative inline-flex h-2 w-2 rounded-full", DOT_COLORS[config.color])}
            />
          </span>
          <span className="transition-all duration-300">{config.label}</span>
        </div>
      </TooltipTrigger>
     
    </Tooltip>
  );
}
