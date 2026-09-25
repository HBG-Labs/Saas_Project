import { useEffect, useRef, useState, type RefObject } from 'react';

const MOTION_QUERY = '(max-width: 760px) and (prefers-reduced-motion: no-preference)';

/** Decorative mobile footage: page position is the only playback control. */
export function FieldScrollVideo({ target }: { target: RefObject<HTMLDivElement | null> }) {
  const video = useRef<HTMLVideoElement>(null);
  const fraction = useRef(0);
  const [enabled, setEnabled] = useState(false);
  const [nearby, setNearby] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!window.matchMedia || typeof IntersectionObserver === 'undefined') return;
    const media = window.matchMedia(MOTION_QUERY);
    const update = () => {
      setEnabled(media.matches);
      setReady(false);
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const seek = () => {
    const element = video.current;
    if (!element || !Number.isFinite(element.duration) || element.seeking) return;
    const time = fraction.current * Math.max(0, element.duration - 0.08);
    if (Math.abs(element.currentTime - time) > 0.035) element.currentTime = time;
  };

  useEffect(() => {
    if (!enabled || failed || !target.current) return;
    let frame = 0;
    let visible = false;
    const update = () => {
      frame = 0;
      if (!visible || document.hidden || !target.current) return;
      const rect = target.current.getBoundingClientRect();
      // Travel through the viewport, without capturing touch or pinning the page.
      fraction.current = Math.min(
        1,
        Math.max(
          0,
          (window.innerHeight * 0.8 - rect.top) / (rect.height + window.innerHeight * 0.6),
        ),
      );
      seek();
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = !!entry?.isIntersecting;
        if (visible) setNearby(true);
        schedule();
      },
      { rootMargin: '300px' },
    );
    observer.observe(target.current);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    document.addEventListener('visibilitychange', schedule);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('visibilitychange', schedule);
    };
  }, [enabled, failed, target]);

  if (!enabled || !nearby || failed) return null;

  return (
    <video
      ref={video}
      className={ready ? 'lp-field-photo lp-field-video is-ready' : 'lp-field-photo lp-field-video'}
      src="/images/landing/technician-scroll-mobile.mp4"
      muted
      playsInline
      controls={false}
      disablePictureInPicture
      preload="auto"
      aria-hidden="true"
      onLoadedData={() => {
        setReady(true);
        seek();
      }}
      onSeeked={seek}
      onError={() => setFailed(true)}
    />
  );
}
