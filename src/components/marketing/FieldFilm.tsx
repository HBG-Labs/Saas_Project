import { useEffect, useRef, useState } from 'react';

/** The film is scrubbed by page position, never by an autoplay loop. */
export function FieldFilm() {
  const section = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [loadFilm, setLoadFilm] = useState(false);
  const [progress, setProgress] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [failed, setFailed] = useState(false);
  const [filmSource, setFilmSource] = useState('');
  const desiredTime = useRef(0);
  const manualControl = useRef(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (reduced || !section.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setFilmSource(
            window.matchMedia('(max-width: 640px)').matches
              ? '/images/landing/technician-scroll-mobile.mp4'
              : '/images/landing/technician-scroll.mp4',
          );
          setLoadFilm(true);
          observer.disconnect();
        }
      },
      { rootMargin: '500px' },
    );
    observer.observe(section.current);
    return () => observer.disconnect();
  }, [reduced]);

  const seek = (fraction: number) => {
    const element = video.current;
    if (!element || !Number.isFinite(element.duration)) return;
    desiredTime.current = fraction * Math.max(0, element.duration - 0.08);
    if (!element.seeking && Math.abs(element.currentTime - desiredTime.current) > 0.035) {
      element.currentTime = desiredTime.current;
    }
  };

  useEffect(() => {
    if (reduced || !section.current) return;
    let frame = 0;
    let visible = false;
    const update = () => {
      frame = 0;
      const element = section.current;
      if (!visible || !element || document.hidden || manualControl.current) return;
      const rect = element.getBoundingClientRect();
      const fraction = Math.min(
        1,
        Math.max(0, (80 - rect.top) / Math.max(1, rect.height - window.innerHeight)),
      );
      setProgress(fraction);
      seek(fraction);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const onScroll = () => {
      manualControl.current = false;
      schedule();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      schedule();
    });
    observer.observe(section.current);
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
  }, [reduced]);

  return (
    <section
      ref={section}
      className={reduced ? 'lp-film is-reduced' : 'lp-film'}
      aria-labelledby="lp-film-title"
    >
      <div className="lp-film__stage">
        <img
          className="lp-film__poster"
          src="/images/landing/technician-male-1800.webp"
          srcSet="/images/landing/technician-male-800.webp 800w, /images/landing/technician-male-1800.webp 1800w"
          sizes="100vw"
          width="1800"
          height="1013"
          loading="lazy"
          decoding="async"
          alt="Un technicien métis consulte son téléphone dans un local technique baigné de lumière"
        />
        {loadFilm && !reduced && !failed && (
          <video
            ref={video}
            src={filmSource}
            className="lp-film__video"
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
            onError={() => setFailed(true)}
            onLoadedData={() => seek(progress)}
            onSeeked={() => {
              const element = video.current;
              if (element && Math.abs(element.currentTime - desiredTime.current) > 0.035)
                element.currentTime = desiredTime.current;
            }}
          />
        )}
        <div className="lp-film__copy">
          <p className="lp-eyebrow">À votre rythme. Sur votre terrain.</p>
          <h2 id="lp-film-title">
            Vous avancez.
            <br />
            <span>Tout suit.</span>
          </h2>
          <p>
            Le bon dossier.
            <br />
            Au moment où vous en avez besoin.
          </p>
        </div>
        <div className="lp-film__bottom">
          <span>
            {reduced || failed
              ? 'Le terrain, au cœur de REZO360'
              : 'Faites défiler. Le terrain prend vie.'}
          </span>
          {!reduced && !failed && (
            <label className="lp-film__control">
              <span className="sr-only">Progression du film de terrain</span>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={Math.round(progress * 100)}
                onKeyDown={(event) => {
                  if (event.key !== 'Home' && event.key !== 'End') return;
                  event.preventDefault();
                  manualControl.current = true;
                  const fraction = event.key === 'End' ? 1 : 0;
                  setProgress(fraction);
                  seek(fraction);
                }}
                onChange={(event) => {
                  manualControl.current = true;
                  const fraction = Number(event.target.value) / 100;
                  setProgress(fraction);
                  seek(fraction);
                }}
              />
              <span aria-hidden="true">
                {String(Math.round(progress * 100)).padStart(2, '0')} / 100
              </span>
            </label>
          )}
        </div>
      </div>
    </section>
  );
}
