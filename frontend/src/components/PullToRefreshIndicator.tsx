interface PullToRefreshIndicatorProps {
  pullDistance: number;
  refreshing: boolean;
  threshold?: number;
}

export const PullToRefreshIndicator = ({
  pullDistance,
  refreshing,
  threshold = 80,
}: PullToRefreshIndicatorProps) => {
  if (pullDistance === 0 && !refreshing) return null;

  const progress = Math.min(pullDistance / threshold, 1);
  const rotation = pullDistance * 3;
  const ready = progress >= 1;

  return (
    <div
      className="flex justify-center overflow-hidden transition-[height] duration-200"
      style={{ height: refreshing ? 48 : pullDistance > 0 ? Math.min(pullDistance, 60) : 0 }}
    >
      <div className="flex items-center justify-center py-2">
        <svg
          className={`w-6 h-6 text-primary-500 ${refreshing ? 'animate-spin' : ''}`}
          style={!refreshing ? { transform: `rotate(${rotation}deg)`, opacity: progress } : undefined}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        {!refreshing && ready && (
          <span className="ml-2 text-sm text-primary-500 font-medium">Pustiť pre obnovenie</span>
        )}
        {refreshing && (
          <span className="ml-2 text-sm text-primary-500 font-medium">Obnovujem...</span>
        )}
      </div>
    </div>
  );
};
