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
const MAX_THUMB_HEIGHT = 120;

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
    if (!scrollElement) return;

    const { clientHeight, scrollHeight, scrollTop } = scrollElement;
    const scrollable = scrollHeight > clientHeight + 1;

    if (!scrollable) {
      setMetrics({ thumbHeight: MIN_THUMB_HEIGHT, thumbTop: 0, scrollable: false });
      return;
    }

    if (!trackElement) return;
    const trackHeight = trackElement.clientHeight;
    if (trackHeight <= 0) return;

    const proportionalHeight = (clientHeight / scrollHeight) * trackHeight;
    const thumbHeight = Math.max(
      MIN_THUMB_HEIGHT,
      Math.min(MAX_THUMB_HEIGHT, proportionalHeight),
    );
    const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
    const maxScrollTop = Math.max(1, scrollHeight - clientHeight);
    const thumbTop = (scrollTop / maxScrollTop) * maxThumbTop;

    setMetrics({ thumbHeight, thumbTop, scrollable: true });
  }, []);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    const resizeObserver = new ResizeObserver(updateMetrics);
    resizeObserver.observe(scrollElement);
    if (scrollElement.firstElementChild) resizeObserver.observe(scrollElement.firstElementChild);

    scrollElement.addEventListener("scroll", updateMetrics, { passive: true });
    updateMetrics();

    return () => {
      resizeObserver.disconnect();
      scrollElement.removeEventListener("scroll", updateMetrics);
    };
  }, [updateMetrics]);

  useEffect(() => {
    if (!metrics.scrollable || !trackRef.current) return;
    const resizeObserver = new ResizeObserver(updateMetrics);
    resizeObserver.observe(trackRef.current);
    updateMetrics();
    return () => resizeObserver.disconnect();
  }, [metrics.scrollable, updateMetrics]);

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
    <div className="relative min-h-0 flex-1 overflow-visible bg-[#12304D] xl:overflow-hidden">
      <div
        ref={scrollRef}
        tabIndex={0}
        className="h-auto overflow-visible bg-[#12304D] px-4 pb-8 pt-5 outline-none sm:px-6 sm:pt-6 xl:h-full xl:overflow-y-auto xl:overscroll-contain xl:px-5 xl:pt-6 xl:pr-8 min-[1400px]:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>

      {metrics.scrollable ? (
        <div
          ref={trackRef}
          className="absolute bottom-4 right-2 top-4 hidden w-1.5 cursor-pointer rounded-full bg-white/[0.05] xl:block"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) scrollFromPointer(event.clientY);
          }}
        >
          <button
            type="button"
            aria-label="Scroll workspace content"
            onPointerDown={handleThumbPointerDown}
            onPointerMove={handleThumbPointerMove}
            onPointerUp={stopDragging}
            onPointerCancel={stopDragging}
            className={`absolute left-0 w-1.5 touch-none rounded-full bg-amber-300/55 transition-colors hover:bg-amber-200/80 ${
              dragging ? "cursor-grabbing" : "cursor-grab"
            }`}
            style={{ height: metrics.thumbHeight, transform: `translateY(${metrics.thumbTop}px)` }}
          />
        </div>
      ) : null}
    </div>
  );
}
