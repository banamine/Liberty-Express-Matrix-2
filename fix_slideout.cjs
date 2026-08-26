const fs = require('fs');
let code = fs.readFileSync('src/components/SlideOutGuide.tsx', 'utf8');

code = code.replace(
  `  useEffect(() => {
    const updateImage = () => {`,
  `  const intervalRef1 = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const updateImage = () => {`
);

fs.writeFileSync('src/components/SlideOutGuide.tsx', code);
