"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent, ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type Metrics = {
  thumbHeight: number;
  thumbTop: number;
  scrollable: boolean;
};

const MIN_THUMB_HEIGHT = 48;

export default function AiBuilderDesktopScrollArea({ children }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ startY: number; startScrollTop: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [metrics, setMetrics] = useState<Metrics>({
    thumbHeight: MIN_THUMB_HEIGHT,
    thumbTop: 0,
    scrollable: false,
  });

  const updateMetrics = useCallback(() => {
    const scrollElement = scrollRef.current;
    const trackElement = trackRef.current;
    if (!scrollElement || !trackElement) return;

    const { clientHeight, scrollHeight, scrollTop } = scrollElement;
    const trackHeight = trackElement.clientHeight;
    const scrollable = scrollHeight > clientHeight + 1;

    if (!scrollable || trackHeight <= 0) {
      setMetrics({ thumbHeight: trackHeight, thumbTop: 0, scrollable: false });
      return;
    }

    const thumbHeight = Math.max(
      MIN_THUMB_HEIGHT,
      Math.min(trackHeight, (clientHeight / scrollHeight) * trackHeight),
    );
    const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
    const maxScrollTop = Math.max(1, scrollHeight - clientHeight);
    const thumbTop = (scrollTop / maxScrollTop) * maxThumbTop;

    setMetrics({ thumbHeight, thumbTop, scrollable: true });
  }, []);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    const trackElement = trackRef.current;
    if (!scrollElement || !trackElement) return;

    const resizeObserver = new ResizeObserver(updateMetrics);
    resizeObserver.observe(scrollElement);
    resizeObserver.observe(trackElement);
    if (scrollElement.firstElementChild) resizeObserver.observe(scrollElement.firstElementChild);

    scrollElement.addEventListener("scroll", updateMetrics, { passive: true });
    updateMetrics();

    return () => {
      resizeObserver.disconnect();
      scrollElement.removeEventListener("scroll", updateMetrics);
    };
  }, [updateMetrics]);

  const scrollFromPointer = useCallback(
    (clientY: number) => {
      const scrollElement = scrollRef.current;
      const trackElement = trackRef.current;
      if (!scrollElement || !trackElement || !metrics.scrollable) return;

      const trackRect = trackElement.getBoundingClientRect();
      const maxThumbTop = Math.max(1, trackElement.clientHeight - metrics.thumbHeight);
      const requestedThumbTop = Math.min(
        maxThumbTop,
        Math.max(0, clientY - trackRect.top - metrics.thumbHeight / 2),
      );
      const maxScrollTop = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight);
      scrollElement.scrollTop = (requestedThumbTop / maxThumbTop) * maxScrollTop;
    },
    [metrics],
  );

  const handleThumbPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    const scrollElement = scrollRef.current;
    if (!scrollElement || !metrics.scrollable) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      startY: event.clientY,
      startScrollTop: scrollElement.scrollTop,
    };
    setDragging(true);
  };

  const handleThumbPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const scrollElement = scrollRef.current;
    const trackElement = trackRef.current;
    const dragState = dragStateRef.current;
    if (!scrollElement || !trackElement || !dragState || !metrics.scrollable) return;

    event.preventDefault();
    const maxThumbTop = Math.max(1, trackElement.clientHeight - metrics.thumbHeight);
    const maxScrollTop = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight);
    const scrollPerPixel = maxScrollTop / maxThumbTop;
    scrollElement.scrollTop = dragState.startScrollTop + (event.clientY - dragState.startY) * scrollPerPixel;
  };

  const stopDragging = (event: PointerEvent<HTMLButtonElement>) => {
    dragStateRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <div
        ref={scrollRef}
        tabIndex={0}
        className="h-full overflow-y-auto overscroll-contain px-5 pb-8 pt-6 pr-8 sm:px-6 sm:pt-7 min-[1400px]:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>

      <div
        ref={trackRef}
        className="absolute bottom-4 right-2 top-4 w-1.5 cursor-pointer rounded-full bg-white/[0.045]"
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) scrollFromPointer(event.clientY);
        }}
        aria-hidden={!metrics.scrollable}
      >
        {metrics.scrollable ? (
          <button
            type="button"
            aria-label="Scroll review content"
            onPointerDown={handleThumbPointerDown}
            onPointerMove={handleThumbPointerMove}
            onPointerUp={stopDragging}
            onPointerCancel={stopDragging}
            className={`absolute left-0 w-1.5 touch-none rounded-full bg-amber-300/70 transition-colors hover:bg-amber-200 ${
              dragging ? "cursor-grabbing" : "cursor-grab"
            }`}
            style={{ height: metrics.thumbHeight, transform: `translateY(${metrics.thumbTop}px)` }}
          />
        ) : null}
      </div>
    </div>
  );
}
