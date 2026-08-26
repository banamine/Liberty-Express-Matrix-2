const fs = require('fs');
let code = fs.readFileSync('src/hooks/useSystemCountdown.ts', 'utf8');

if (!code.includes('intervalRef')) {
  code = code.replace(
    `export function useSystemCountdown(endTimeStr?: string) {
  const [timeLeft, setTimeLeft] = useState<string>('');`,
    `export function useSystemCountdown(endTimeStr?: string) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);`
  );
  
  code = code.replace(
    `    updateTimer(); // Initial call
    const interval = setInterval(updateTimer, 1000); // System clock tick

    return () => clearInterval(interval);
  }, [endTimeStr]);`,
    `    updateTimer(); // Initial call
    intervalRef.current = setInterval(updateTimer, 1000); // System clock tick

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [endTimeStr]);`
  );
  
  fs.writeFileSync('src/hooks/useSystemCountdown.ts', code);
}
