import { useEffect, useRef, useState } from 'react';

import '@/styles/landing-closing.css';

/** Actual video frames follow page position; the approved first film is independent. */
export function ClosingScene() {
  const scene = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const position = useRef(0);
  const manual = useRef(false);
  const [percent, setPercent] = useState(0);
  const [source, setSource] = useState('');
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reduced, setReduced] = useState(
    () =>
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function' ||
      typeof IntersectionObserver === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(typeof IntersectionObserver === 'undefined' || media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);

  const seek = (fraction: number) => {
    position.current = fraction;
    const element = video.current;
    if (!element || !Number.isFinite(element.duration) || element.seeking) return;
    const target = fraction * Math.max(0, element.duration - 0.08);
    if (Math.abs(element.currentTime - target) > 0.035) element.currentTime = target;
  };

  useEffect(() => {
    if (reduced || failed || !scene.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setSource(
          window.matchMedia('(max-width: 640px)').matches
            ? '/images/landing/closing-scroll-mobile.mp4'
            : '/images/landing/closing-scroll.mp4',
        );
        observer.disconnect();
      },
      { rootMargin: '600px' },
    );
    observer.observe(scene.current);
    return () => observer.disconnect();
  }, [reduced, failed]);

  useEffect(() => {
    const element = scene.current;
    if (!element || reduced || failed) return;
    let visible = false;
    let frame = 0;
    const update = () => {
      frame = 0;
      const surface = stage.current;
      if (!visible || document.hidden || !surface || manual.current) return;
      const top = parseFloat(getComputedStyle(surface).top) || 0;
      const travel = Math.max(1, element.offsetHeight - surface.offsetHeight);
      const fraction = Math.min(
        1,
        Math.max(0, (top - element.getBoundingClientRect().top) / travel),
      );
      seek(fraction);
      setPercent(Math.round(fraction * 100));
    };
    const schedule = () => {
      if (visible && !frame) frame = requestAnimationFrame(update);
    };
    const onScroll = () => {
      manual.current = false;
      schedule();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      schedule();
    });
    observer.observe(element);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', schedule);
    document.addEventListener('visibilitychange', schedule);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('visibilitychange', schedule);
    };
  }, [reduced, failed]);

  const control = (value: number) => {
    manual.current = true;
    setPercent(value);
    seek(value / 100);
  };

  return (
    <div
      className={reduced || failed ? 'lp-closing-scene is-still' : 'lp-closing-scene'}
      ref={scene}
    >
      <div className="lp-closing-stage" ref={stage}>
        <figure className="lp-closing-photo">
          <img
            src="/images/landing/closing-workday-1800.webp"
            srcSet="/images/landing/closing-workday-800.webp 800w, /images/landing/closing-workday-1800.webp 1800w"
            sizes="(max-width: 640px) calc(100vw - 32px), (max-width: 1680px) calc(100vw - 80px), 1600px"
            width="1800"
            height="1013"
            loading="lazy"
            decoding="async"
            alt="À la fin d’une intervention, un professionnel range ses outils puis referme leur mallette"
          />
          {source && !reduced && !failed && (
            <video
              ref={video}
              src={source}
              className={ready ? 'is-ready' : undefined}
              muted
              playsInline
              preload="auto"
              aria-hidden="true"
              onLoadedData={() => {
                setReady(true);
                seek(position.current);
              }}
              onSeeked={() => seek(position.current)}
              onError={() => setFailed(true)}
            />
          )}
          <figcaption className="sr-only">
            Le dernier geste d’une intervention, à votre rythme.
          </figcaption>
        </figure>
        <div className="lp-closing-controls">
          <span>
            {reduced || failed
              ? 'Le dernier geste. Le travail garde une trace.'
              : 'Faites défiler pour terminer l’intervention.'}
          </span>
          {!reduced && !failed && (
            <label>
              <span className="sr-only">Progression du film de fin d’intervention</span>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={percent}
                onChange={(event) => control(Number(event.target.value))}
                onKeyDown={(event) => {
                  if (event.key !== 'Home' && event.key !== 'End') return;
                  event.preventDefault();
                  control(event.key === 'End' ? 100 : 0);
                }}
              />
            </label>
          )}
        </div>
      </div>
      {!reduced && !failed && <div className="lp-closing-travel" aria-hidden="true" />}
    </div>
  );
}
