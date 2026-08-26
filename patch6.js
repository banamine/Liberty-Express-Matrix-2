import fs from 'fs';
let code = fs.readFileSync('src/pages/player1.tsx', 'utf8');

// The file currently has this exactly:
//    if (!videoRef.current || (videoRef.current as any)._audioRouted) return;
//    (videoRef.current as any)._audioRouted = true;
//    try {
//      // 1. Initialize Audio Context (Handle Safari prefix if needed)
//      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
//      const audioCtx = new AudioContextClass();
//      audioCtxRef.current = audioCtx;
//
//      // 2. Create the Nodes
//      const source = audioCtx.createMediaElementSource(videoRef.current);
//      const compressor = audioCtx.createDynamicsCompressor();
//      const gainNode = audioCtx.createGain();
//      gainNodeRef.current = gainNode;

const target = `    if (!videoRef.current || (videoRef.current as any)._audioRouted) return;
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
      gainNodeRef.current = gainNode;`;

const replacement = `    if (!videoRef.current) return;
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
      (videoRef.current as any)._gainNode = gainNode;`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
} else {
  console.log("Could not find target!");
}

const cleanupTarget = `    return () => {
      // Clean up to prevent 'AudioContext limit reached' leaks on unmount
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    };`;

const cleanupReplacement = `    return () => {
      // GC handles context on node destruction
    };`;

if (code.includes(cleanupTarget)) {
  code = code.replace(cleanupTarget, cleanupReplacement);
} else {
  console.log("Could not find cleanupTarget!");
}

fs.writeFileSync('src/pages/player1.tsx', code);
