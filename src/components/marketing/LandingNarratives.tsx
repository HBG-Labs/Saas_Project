import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';

import '@/styles/landing-narratives.css';

const VOICE_TIMINGS = [1800, 650, 650, 650, 950, 850, 850, 900] as const;

/** A finite, visibility-aware story. Its clock stops when the story cannot be seen. */
function useNarrative(timings: readonly number[], sectionRef: RefObject<HTMLElement | null>) {
  const remaining = useRef<number | null>(null);
  const generation = useRef(0);
  const [inView, setInView] = useState(() => typeof IntersectionObserver === 'undefined');
  const [pageVisible, setPageVisible] = useState(
    () => typeof document === 'undefined' || document.visibilityState !== 'hidden',
  );
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [frame, setFrame] = useState(0);
  const [paused, setPaused] = useState(false);
  const [run, setRun] = useState(0);
  const displayFrame = reducedMotion ? timings.length : frame;
  const complete = displayFrame === timings.length;
  const running = inView && pageVisible && !paused && !complete && !reducedMotion;

  useEffect(() => {
    const query =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
    const onMotionChange = () => setReducedMotion(Boolean(query?.matches));
    const onVisibilityChange = () => setPageVisible(document.visibilityState !== 'hidden');
    query?.addEventListener('change', onMotionChange);
    document.addEventListener('visibilitychange', onVisibilityChange);
    const node = sectionRef.current;
    const observer =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(([entry]) => setInView(Boolean(entry?.isIntersecting)), {
            threshold: 0.12,
          })
        : null;
    if (node) observer?.observe(node);
    return () => {
      query?.removeEventListener('change', onMotionChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      observer?.disconnect();
    };
  }, [sectionRef]);

  useEffect(() => {
    if (!running) return;
    const delay = remaining.current ?? timings[frame] ?? 0;
    const started = performance.now();
    const currentGeneration = generation.current;
    let advanced = false;
    const timeout = window.setTimeout(() => {
      advanced = true;
      remaining.current = null;
      setFrame((current) => Math.min(current + 1, timings.length));
    }, delay);
    return () => {
      window.clearTimeout(timeout);
      if (!advanced && currentGeneration === generation.current) {
        remaining.current = Math.max(0, delay - (performance.now() - started));
      }
    };
  }, [frame, running, timings, run]);

  function replay() {
    generation.current += 1;
    remaining.current = null;
    setFrame(0);
    setPaused(false);
    setRun((current) => current + 1);
  }

  return {
    frame: displayFrame,
    paused,
    running,
    complete,
    reducedMotion,
    replay,
    togglePause: () => setPaused((current) => !current),
  };
}

function PlaybackControls({
  narrative,
  name,
}: {
  narrative: ReturnType<typeof useNarrative>;
  name: string;
}) {
  if (narrative.reducedMotion)
    return <span className="ln-motion-note">Version sans animation</span>;
  return (
    <div className="ln-playback">
      {!narrative.complete && (
        <button
          type="button"
          onClick={narrative.togglePause}
          aria-label={`${narrative.paused ? 'Reprendre' : 'Mettre en pause'} ${name}`}
        >
          <span aria-hidden="true">{narrative.paused ? '▶' : 'Ⅱ'}</span>
          {narrative.paused ? 'Reprendre' : 'Pause'}
        </button>
      )}
      <button type="button" onClick={narrative.replay} aria-label={`Rejouer ${name}`}>
        <span aria-hidden="true">↺</span> Rejouer
      </button>
    </div>
  );
}

const transcript = [
  'Intervention terminée sur le site.',
  'Le filtre a été remplacé et les raccordements contrôlés.',
  'Les essais sont conformes.',
  'Prévoir une visite de contrôle dans six mois.',
];
const waveform = [
  19, 32, 46, 30, 59, 82, 52, 35, 67, 94, 72, 45, 63, 38, 86, 100, 62, 42, 74, 55, 31, 68, 89, 49,
  28, 58, 37, 23,
];
const voiceStages = ['Enregistrer', 'Transcrire', 'Structurer', 'Compte rendu', 'Document'];

export function VoiceNarrative() {
  const stageRef = useRef<HTMLDivElement>(null);
  const narrative = useNarrative(VOICE_TIMINGS, stageRef);
  const { frame } = narrative;
  const stage = frame === 0 ? 0 : frame <= 3 ? 1 : frame <= 6 ? 2 : frame === 7 ? 3 : 4;

  return (
    <section id="voix" className="ln-section ln-voice" aria-labelledby="ln-voice-title">
      <div className="ln-container">
        <div className="ln-heading">
          <div>
            <p className="ln-eyebrow">La voix devient une trace écrite</p>
            <h2 id="ln-voice-title">
              Dictez vos notes.
              <br />
              <span>Préparez votre compte rendu.</span>
            </h2>
          </div>
          <p>
            Les détails sont encore frais. Enregistrez-les, retrouvez la transcription et structurez
            votre document. Vous le relisez avant de le partager.
          </p>
        </div>

        <figure className="ln-voice-scene">
          <img
            src="/images/landing/voice-technician-1800.webp"
            srcSet="/images/landing/voice-technician-800.webp 800w, /images/landing/voice-technician-1800.webp 1800w"
            sizes="(max-width: 760px) calc(100vw - 40px), (max-width: 1600px) 58vw, 900px"
            width="1800"
            height="1200"
            loading="lazy"
            decoding="async"
            alt="Une technicienne dicte une note vocale sur son smartphone à la fin d’une intervention"
          />
          <figcaption>
            <span>Sur le terrain</span>
            <p>Moins de notes à reprendre.</p>
            <p>De la parole au document, vous gardez la main.</p>
          </figcaption>
        </figure>

        <div
          ref={stageRef}
          className="ln-voice-stage"
          data-running={narrative.running}
          data-stage={stage}
        >
          <div className="ln-voice-toolbar">
            <span className="ln-voice-brand">
              <span aria-hidden="true" /> REZO Voice
            </span>
            <span className="ln-demo-label">Démonstration illustrée</span>
          </div>
          <div className="ln-voice-workspace">
            <div className="ln-recording">
              <div className="ln-recording-meta">
                <span>Note de terrain</span>
                <span>00:18</span>
              </div>
              <div className="ln-wave" aria-hidden="true">
                {waveform.map((height, index) => (
                  <i
                    key={index}
                    style={
                      {
                        '--ln-wave-height': `${height}%`,
                        '--ln-wave-delay': `${index * -0.065}s`,
                      } as CSSProperties
                    }
                  />
                ))}
              </div>
              <p className="ln-recording-state">
                {stage === 0 ? 'La voix capture l’essentiel.' : 'Chaque détail reste accessible.'}
              </p>
              <div className="ln-transcript">
                <p className="ln-small-label">Transcription</p>
                <p className="ln-transcript-text">
                  <span className="sr-only">{transcript.join(' ')}</span>
                  {transcript.map((phrase, index) => (
                    <span
                      key={phrase}
                      aria-hidden="true"
                      className={frame > index ? 'is-revealed' : ''}
                    >
                      {phrase}{' '}
                    </span>
                  ))}
                </p>
              </div>
            </div>

            <div className="ln-document-area">
              <article
                className="ln-document"
                aria-label="Exemple de compte rendu structuré à partir de la note vocale"
              >
                <div className="ln-document-top">
                  <span>REZO360</span>
                  <span>INTERVENTION</span>
                </div>
                <h3>
                  Compte rendu
                  <br />
                  d’intervention
                </h3>
                <p className="ln-document-caption">Maintenance préventive · Exemple</p>
                <div className={`ln-document-block ${frame >= 4 ? 'is-revealed' : ''}`}>
                  <h4>Travaux réalisés</h4>
                  <p>
                    Remplacement du filtre.
                    <br />
                    Contrôle des raccordements.
                  </p>
                </div>
                <div className={`ln-document-block ${frame >= 5 ? 'is-revealed' : ''}`}>
                  <h4>Résultat des essais</h4>
                  <p>Essais conformes.</p>
                </div>
                <div className={`ln-document-block ${frame >= 6 ? 'is-revealed' : ''}`}>
                  <h4>Prochaine action</h4>
                  <p>Visite de contrôle dans six mois.</p>
                </div>
                <div className={`ln-document-signoff ${frame >= 7 ? 'is-revealed' : ''}`}>
                  <span aria-hidden="true">✓</span>
                  <span>{frame >= 8 ? 'Document prêt à être relu' : 'Compte rendu structuré'}</span>
                </div>
              </article>
            </div>
          </div>
          <div className="ln-story-footer">
            <ol className="ln-voice-progress" aria-label="Étapes de la démonstration vocale">
              {voiceStages.map((label, index) => (
                <li
                  key={label}
                  className={stage >= index ? 'is-reached' : ''}
                  aria-current={stage === index ? 'step' : undefined}
                >
                  <span aria-hidden="true">0{index + 1}</span>
                  {label}
                </li>
              ))}
            </ol>
            <PlaybackControls narrative={narrative} name="la démonstration vocale" />
          </div>
        </div>
        <p className="ln-footnote">
          Exemple de mise en forme. Vous gardez la main sur le contenu et sa validation.
        </p>
      </div>
    </section>
  );
}
