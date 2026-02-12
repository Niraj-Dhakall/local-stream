import { useEffect, useRef, useState } from "react";

type Countdown = {
  seconds: number;
  isActive: boolean;
  start: VoidFunction;
  pause: VoidFunction;
  resume: VoidFunction;
  reset: (time?: Time) => void;
};
type useCountdownParams = {
  seconds?: number;
  autoStart?: boolean;
  onComplete?: () => void;
  expiresAt: number;
};
type Time = {
  seconds: number;
};

const useCountdown = ({
  seconds = 0,
  autoStart = true,
  onComplete,
  expiresAt,
}: useCountdownParams) => {
  const intervalRef = useRef<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);

  const calculateRemainingTime = () => {
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));
    
    setRemainingSeconds(remaining);
    
    if (remaining <= 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsActive(false);
      onComplete?.();
    }
  };

  useEffect(() => {
    calculateRemainingTime();
    
    if (autoStart) {
      intervalRef.current = window.setInterval(calculateRemainingTime, 1000);
      setIsActive(true);
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [expiresAt, autoStart, onComplete]);
  const pause = (): void => {
    if (!isActive || !intervalRef.current) return;
    
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    setIsActive(false);
  };

  const start = (): void => {
    if (isActive || remainingSeconds <= 0) return;
    
    intervalRef.current = window.setInterval(calculateRemainingTime, 1000);
    setIsActive(true);
  };

  const reset = (time?: Time) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const newExpiresAt = Date.now() + (time?.seconds || seconds) * 1000;
    
    if (autoStart) {
      intervalRef.current = window.setInterval(calculateRemainingTime, 1000);
      setIsActive(true);
    } else {
      setIsActive(false);
    }
  };

  const countdown: Countdown = {
    isActive,
    pause,
    start,
    reset,
    resume: start,
    seconds: remainingSeconds,
  };
  
  return countdown;
};

export default useCountdown;
