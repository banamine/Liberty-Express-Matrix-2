const fs = require('fs');
let code = fs.readFileSync('src/pages/player2.tsx', 'utf8');

if (!code.includes('const handleInteract = () => {')) {
  code = code.replace(
    'const [isMuted, setIsMuted] = useState(true);',
    'const [isMuted, setIsMuted] = useState(true);\n  const handleInteract = () => {\n    if (videoRef.current) {\n      videoRef.current.muted = false;\n      videoRef.current.volume = 1.0;\n      videoRef.current.play().catch(e => { if (e.name !== "AbortError") console.error(e); });\n      setNeedsInteraction(false);\n      setIsPlaying(true);\n    }\n  };'
  );
  fs.writeFileSync('src/pages/player2.tsx', code);
}
