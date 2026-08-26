const fs = require('fs');
let code = fs.readFileSync('src/pages/player1.tsx', 'utf8');

const target = `  useEffect(() => {
    if (!videoRef.current || (videoRef.current as any)._audioRouted) return;
    (videoRef.current as any)._audioRouted = true;
    try {
      // 1. Initialize Audio Context (Handle Safari prefix if needed)
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioCtxRef.current = audioCtx;

      // 2. Create the Nodes
      const source = audioCtx.createMediaElementSource(videoRef.current);
      const compressor = audioCtx.createDynamicsCompressor();
      const gainNode = audioCtx.createGain();
      gainNodeRef.current = gainNode;

      // 3. Broadcast-Standard Compressor Configuration
      compressor.threshold.value = -24; // Reacts to moderately quiet sounds
      compressor.knee.value = 30;       // Soft knee for smooth, invisible transition
      compressor.ratio.value = 12;      // Hard compression ratio to enforce the ceiling
      compressor.attack.value = 0.003;  // Fast attack to catch loud spikes instantly
      compressor.release.value = 0.25;  // Smooth release to prevent audio "pumping"

      // 4. Set Baseline Volume Make-up Gain
      gainNode.gain.value = 1.0; 

      // 5. Connect the Chain: Source -> Compressor -> Gain -> Speakers
      source.connect(compressor);
      compressor.connect(gainNode);
      gainNode.connect(audioCtx.destination);
    } catch (err) {
      console.error("[Audio Engine] Failed to route audio nodes:", err);
    }

    return () => {
      // Clean up to prevent 'AudioContext limit reached' leaks on unmount
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    };
  }, []);`;

const replacement = `  useEffect(() => {
    if (!videoRef.current) return;
    try {
      if ((videoRef.current as any)._audioCtx) {
        audioCtxRef.current = (videoRef.current as any)._audioCtx;
        gainNodeRef.current = (videoRef.current as any)._gainNode;
        return;
      }
      
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioCtxRef.current = audioCtx;
      (videoRef.current as any)._audioCtx = audioCtx;

      const source = audioCtx.createMediaElementSource(videoRef.current);
      const compressor = audioCtx.createDynamicsCompressor();
      const gainNode = audioCtx.createGain();
      gainNodeRef.current = gainNode;
      (videoRef.current as any)._gainNode = gainNode;

      compressor.threshold.value = -24;
      compressor.knee.value = 30;
      compressor.ratio.value = 12;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;

      gainNode.gain.value = 1.0; 

      source.connect(compressor);
      compressor.connect(gainNode);
      gainNode.connect(audioCtx.destination);
    } catch (err) {
      console.error("[Audio Engine] Failed to route audio nodes:", err);
    }
    
    return () => {
      // If the video element is being destroyed, we could close it, 
      // but in React Strict Mode it might be reused.
      // We'll let garbage collection handle it if the node is destroyed.
    };
  }, []);`;

code = code.replace(target, replacement);
fs.writeFileSync('src/pages/player1.tsx', code);
