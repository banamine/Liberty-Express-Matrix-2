import { useState, useEffect, useRef } from 'react';

export function useSystemCountdown(endTimeStr: string) {
  const [timeLeft, setTimeLeft] = useState<string>('00:00:00');

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const targetTime = new Date(endTimeStr).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const difference = targetTime - now;

      if (difference <= 0) {
        setTimeLeft('00:00:00');
        return;
      }

      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    };

    updateTimer(); // Initial call
    intervalRef.current = setInterval(updateTimer, 1000); // System clock tick

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [endTimeStr]);

  return timeLeft;
}
