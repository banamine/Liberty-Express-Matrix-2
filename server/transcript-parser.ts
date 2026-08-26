export function parseTranscript(rawContent: string, isSrt: boolean) {
  const results: { start: number, end: number, text: string }[] = [];
  
  if (isSrt) {
    // Basic SRT parser
    const blocks = rawContent.replace(/\r\n/g, '\n').split('\n\n');
    for (const block of blocks) {
      const lines = block.split('\n');
      if (lines.length >= 3) {
        const timeLine = lines[1];
        const textLines = lines.slice(2).join(' ');
        
        const timeMatch = timeLine.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
        if (timeMatch) {
          const start = 
            parseInt(timeMatch[1], 10) * 3600 +
            parseInt(timeMatch[2], 10) * 60 +
            parseInt(timeMatch[3], 10) +
            parseInt(timeMatch[4], 10) / 1000;
            
          const end = 
            parseInt(timeMatch[5], 10) * 3600 +
            parseInt(timeMatch[6], 10) * 60 +
            parseInt(timeMatch[7], 10) +
            parseInt(timeMatch[8], 10) / 1000;
            
          results.push({ start, end, text: textLines });
        }
      }
    }
  } else {
    // TSV parser (assuming start, end, text)
    // Often IA TSV is: start_time \t end_time \t text
    const lines = rawContent.replace(/\r\n/g, '\n').split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      const parts = line.split('\t');
      if (parts.length >= 3) {
        const start = parseFloat(parts[0]);
        const end = parseFloat(parts[1]);
        const text = parts.slice(2).join(' '); // text could contain tabs?
        if (!isNaN(start) && !isNaN(end)) {
          results.push({ start, end, text });
        }
      }
    }
  }
  
  return results;
}
