import { useEffect, useRef } from 'react';

const useAutoLoadMore = ({
  canLoadMore,
  enabled = true,
  rootMargin = '240px 0px',
  setVisibleCount,
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
        setVisibleCount((count) => count + step);

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
  }, [canLoadMore, enabled, rootMargin, setVisibleCount, step]);

  return sentinelRef;
};

export default useAutoLoadMore;
