import { useEffect, useRef, useState, useCallback } from 'react';

interface PullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  maxPull?: number;
}

interface PullToRefreshResult {
  containerRef: React.RefObject<HTMLDivElement>;
  refreshing: boolean;
  pullDistance: number;
  isPulling: boolean;
}

export const usePullToRefresh = ({
  onRefresh,
  threshold = 80,
  maxPull = 120,
}: PullToRefreshOptions): PullToRefreshResult => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const startY = useRef(0);
  const currentY = useRef(0);
  const pulling = useRef(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setPullDistance(threshold);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
      setPullDistance(0);
    }
  }, [onRefresh, threshold]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only start pull if scrolled to top
      if (container.scrollTop > 0 || refreshing) return;
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!pulling.current || refreshing) return;

      currentY.current = e.touches[0].clientY;
      const distance = currentY.current - startY.current;

      if (distance > 0 && container.scrollTop === 0) {
        // Apply resistance - pull gets harder the further you go
        const resistedDistance = Math.min(distance * 0.5, maxPull);
        setPullDistance(resistedDistance);
        setIsPulling(true);

        if (resistedDistance > 10) {
          e.preventDefault();
        }
      } else {
        setPullDistance(0);
        setIsPulling(false);
      }
    };

    const handleTouchEnd = () => {
      if (!pulling.current) return;
      pulling.current = false;
      setIsPulling(false);

      if (pullDistance >= threshold && !refreshing) {
        handleRefresh();
      } else {
        setPullDistance(0);
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [refreshing, pullDistance, threshold, maxPull, handleRefresh]);

  return { containerRef, refreshing, pullDistance, isPulling };
};
