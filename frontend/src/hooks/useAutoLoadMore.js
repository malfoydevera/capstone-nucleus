import { useEffect, useRef } from 'react';

/**
 * Observes a sentinel element and triggers loading more content once it
 * scrolls near the viewport, removing the need to click a "Load more" button.
 *
 * Two usage modes:
 * - Client-side slicing: pass `setVisibleCount` + `step` to reveal more of an
 *   already-fetched array (e.g. `setVisibleCount((count) => count + step)`).
 * - Server-paginated / async: pass `onLoadMore` to invoke a fetch callback
 *   directly (the callback is responsible for its own in-flight guard, e.g.
 *   `if (loadingMore) return;`).
 */
const useAutoLoadMore = ({
  canLoadMore,
  enabled = true,
  rootMargin = '240px 0px',
  setVisibleCount,
  onLoadMore,
  step,
}) => {
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!enabled || !canLoadMore || !sentinelRef.current) {
      return undefined;
    }

    const node = sentinelRef.current;
    let scheduled = false;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting || scheduled) {
          return;
        }

        scheduled = true;
        if (onLoadMore) {
          onLoadMore();
        } else {
          setVisibleCount((count) => count + step);
        }

        requestAnimationFrame(() => {
          scheduled = false;
        });
      },
      { rootMargin }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [canLoadMore, enabled, rootMargin, setVisibleCount, onLoadMore, step]);

  return sentinelRef;
};

export default useAutoLoadMore;
