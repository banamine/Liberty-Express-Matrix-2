const fs = require('fs');
let code = fs.readFileSync('src/components/SlideOutGuide.tsx', 'utf8');

if (!code.includes('intervalRef1')) {
  code = code.replace(
    `  useEffect(() => {
    // Determine the active image based on time elapsed`,
    `  const intervalRef1 = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    // Determine the active image based on time elapsed`
  );
  
  code = code.replace(
    `    // Only run this interval if the segment is currently crossing the Red Playhead (Now)
    const interval = setInterval(updateImage, 60000); 

    return () => clearInterval(interval);
  }, [segmentStart, segmentDuration, baseThumbUrl]);`,
    `    // Only run this interval if the segment is currently crossing the Red Playhead (Now)
    intervalRef1.current = setInterval(updateImage, 60000); 

    return () => {
      if (intervalRef1.current) clearInterval(intervalRef1.current);
    };
  }, [segmentStart, segmentDuration, baseThumbUrl]);`
  );
  
  code = code.replace(
    `  useEffect(() => {
    if (isOpen) {
      const interval = setInterval(() => setNow(Date.now() / 1000), 60000); // update playhead position slowly
      return () => clearInterval(interval);
    }
  }, [isOpen]);`,
    `  const intervalRef2 = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (isOpen) {
      intervalRef2.current = setInterval(() => setNow(Date.now() / 1000), 60000); // update playhead position slowly
      return () => {
        if (intervalRef2.current) clearInterval(intervalRef2.current);
      };
    }
  }, [isOpen]);`
  );
  
  fs.writeFileSync('src/components/SlideOutGuide.tsx', code);
}
