import { BroadcastSegment } from '@/src/hooks/useStaticRundown';

export function getLiveLoopState(segments: BroadcastSegment[]) {
  if (!segments || segments.length === 0) return { currentSegment: null, offset: 0 };
  
  const totalDuration = segments.reduce((acc, seg) => acc + seg.duration, 0);
  if (totalDuration === 0) return { currentSegment: segments[0], offset: 0 };

  const anchorTime = segments[0].start;
  const now = Date.now() / 1000;
  
  // How much time has passed since the anchor? 
  // We use Math.max to avoid negative elapsed time if now < anchorTime (unlikely but possible)
  const elapsed = Math.max(0, now - anchorTime);
  
  // Where are we in the loop?
  const loopTime = elapsed % totalDuration;
  
  let runningTime = 0;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (loopTime >= runningTime && loopTime < runningTime + seg.duration) {
      return {
        currentSegment: seg,
        offset: loopTime - runningTime,
        segmentIndex: i
      };
    }
    runningTime += seg.duration;
  }
  
  // Fallback
  return {
    currentSegment: segments[0],
    offset: 0,
    segmentIndex: 0
  };
}
