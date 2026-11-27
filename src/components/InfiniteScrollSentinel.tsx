import React, { useEffect, useRef, useState } from 'react';

export interface InfiniteScrollSentinelProps {
  /** Called when the sentinel scrolls near the viewport — the parent appends the next batch. */
  onLoadMore: () => void;
  /** Whether more items are still available to load. */
  hasMore: boolean;
  loadingText?: string;
  endText?: string;
}

/**
 * Invisible sentinel that triggers `onLoadMore` when it scrolls near the viewport
 * (generous 300px rootMargin), powering automatic infinite scroll for result lists.
 *
 * After firing, the observer is re-armed once React commits the new batch so the
 * loop continues if the sentinel is still (or again) in view — no clicks required.
 */
export const InfiniteScrollSentinel: React.FC<InfiniteScrollSentinelProps> = ({
  onLoadMore,
  hasMore,
  loadingText = 'جارٍ تحميل المزيد…',
  endText = 'تم عرض كل النتائج',
}) => {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!hasMore) {
      setIsLoading(false);
    }
    if (typeof IntersectionObserver === 'undefined') {
      return;
    }
    const element = sentinelRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          if (hasMore) {
            setIsLoading(true);
            onLoadMoreRef.current();
            // Re-observe after React commits the new batch: observe() immediately
            // re-delivers the current intersection state, so the loop keeps going
            // while the sentinel remains in view.
            window.setTimeout(() => {
              observer.unobserve(element);
              observer.observe(element);
            }, 0);
          }
        } else {
          setIsLoading(false);
        }
      },
      { rootMargin: '300px 0px', threshold: 0 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [hasMore]);

  return (
    <div>
      <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />
      {isLoading && (
        <p className="pt-3 text-center text-[11px] font-medium text-[#707971] animate-pulse">
          {loadingText}
        </p>
      )}
      {!hasMore && !isLoading && (
        <p className="pt-3 text-center text-[11px] font-medium text-[#707971]">{endText}</p>
      )}
    </div>
  );
};
