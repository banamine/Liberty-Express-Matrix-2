const fs = require('fs');
let code = fs.readFileSync('src/pages/player1.tsx', 'utf8');

// First replace the early return and AudioContext creation
code = code.replace(
  'if (!videoRef.current || (videoRef.current as any)._audioRouted) return;\n    (videoRef.current as any)._audioRouted = true;\n    try {\n      // 1. Initialize Audio Context (Handle Safari prefix if needed)\n      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;\n      const audioCtx = new AudioContextClass();\n      audioCtxRef.current = audioCtx;\n\n      // 2. Create the Nodes\n      const source = audioCtx.createMediaElementSource(videoRef.current);\n      const compressor = audioCtx.createDynamicsCompressor();\n      const gainNode = audioCtx.createGain();\n      gainNodeRef.current = gainNode;',
  `if (!videoRef.current) return;
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

      // 2. Create the Nodes
      const source = audioCtx.createMediaElementSource(videoRef.current);
      const compressor = audioCtx.createDynamicsCompressor();
      const gainNode = audioCtx.createGain();
      gainNodeRef.current = gainNode;
      (videoRef.current as any)._gainNode = gainNode;`
);

// Then remove the cleanup code so we don't close the AudioContext if we're reusing it
code = code.replace(
  '    return () => {\n      // Clean up to prevent \'AudioContext limit reached\' leaks on unmount\n      if (audioCtxRef.current && audioCtxRef.current.state !== \'closed\') {\n        audioCtxRef.current.close();\n        audioCtxRef.current = null;\n      }\n    };',
  '    return () => {\n      // Let garbage collection clean up the AudioContext when the video node is destroyed\n    };'
);

fs.writeFileSync('src/pages/player1.tsx', code);
