import { useState, useEffect, useRef } from "react";
import { ImageOff } from "lucide-react";

export function RelativeTime({ date }: { date: Date }) {
  const [label, setLabel] = useState('moments ago');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    function update() {
      const secs = Math.floor((Date.now() - date.getTime()) / 1000);
      if (secs < 90)        setLabel('moments ago');
      else if (secs < 3600) setLabel(`${Math.floor(secs / 60)} min ago`);
      else                  setLabel(`${Math.floor(secs / 3600)}h ago`);
    }
    update();
    intervalRef.current = setInterval(update, 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [date]);
  return <>{label}</>;
}

export function ThumbnailCell({ url, alt }: { url: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="w-14 h-9 bg-muted rounded flex items-center justify-center flex-shrink-0">
        <ImageOff className="w-4 h-4 text-muted-foreground" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      className="w-14 h-9 object-cover rounded bg-muted flex-shrink-0"
      onError={() => setFailed(true)}
    />
  );
}
