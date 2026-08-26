import { useState, useRef, TouchEvent } from 'react';

interface UseSwipeToCloseOptions {
  onClose: () => void;
  direction?: 'left' | 'right' | 'bottom';
  threshold?: number;
}

export function useSwipeToClose({ onClose, direction = 'left', threshold = 80 }: UseSwipeToCloseOptions) {
  const [dragOffset, setDragOffset] = useState(0);
  const touchStartRef = useRef<number | null>(null);

  const onTouchStart = (e: TouchEvent) => {
    touchStartRef.current = direction === 'bottom' ? e.touches[0].clientY : e.touches[0].clientX;
  };

  const onTouchMove = (e: TouchEvent) => {
    if (touchStartRef.current === null) return;
    const current = direction === 'bottom' ? e.touches[0].clientY : e.touches[0].clientX;
    const delta = current - touchStartRef.current;
    
    // Only allow dragging in the closing direction
    if (direction === 'left' && delta < 0) {
      setDragOffset(delta);
    } else if (direction === 'right' && delta > 0) {
      setDragOffset(delta);
    } else if (direction === 'bottom' && delta > 0) {
      setDragOffset(delta);
    }
  };

  const onTouchEnd = () => {
    if (direction === 'left' && dragOffset < -threshold) {
      onClose();
    } else if (direction === 'right' && dragOffset > threshold) {
      onClose();
    } else if (direction === 'bottom' && dragOffset > threshold) {
      onClose();
    }
    
    setDragOffset(0);
    touchStartRef.current = null;
  };

  let transform = 'none';
  if (dragOffset !== 0) {
    transform = direction === 'bottom' 
      ? `translateY(${dragOffset}px)` 
      : `translateX(${dragOffset}px)`;
  }

  const touchAction = direction === 'bottom' ? 'pan-x' : 'pan-y';

  return {
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
    style: { transform, transition: dragOffset === 0 ? 'transform 0.3s ease' : 'none', touchAction }
  };
}
