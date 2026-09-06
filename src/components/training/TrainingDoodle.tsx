type TrainingDoodleVariant = 'practice' | 'route' | 'checklist';

export function TrainingDoodle({
  variant,
  className,
}: {
  variant: TrainingDoodleVariant;
  className: string;
}) {
  return (
    <svg
      viewBox="0 0 240 130"
      className={`pointer-events-none absolute ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{
        fontFamily: '"Segoe Print", "Bradley Hand", "Comic Sans MS", cursive',
        filter: 'drop-shadow(0 1px 0 rgb(255 255 255 / 0.2))',
      }}
    >
      {variant === 'practice' ? (
        <>
          <text x="16" y="25" fill="currentColor" stroke="none" fontSize="17">
            voir → essayer
          </text>
          <text x="77" y="50" fill="currentColor" stroke="none" fontSize="17">
            → maîtriser !
          </text>
          <path d="M22 68c28 27 91 35 160 13" />
          <path d="m172 75 10 6-7 9" />
          <path d="M31 48c-8 3-12 8-14 15m188-43c8 6 12 13 13 23" />
          <path d="m209 37 9 6 5-9" />
        </>
      ) : null}

      {variant === 'route' ? (
        <>
          <text x="9" y="23" fill="currentColor" stroke="none" fontSize="16">
            le bon ordre, simplement
          </text>
          <path d="M26 73c32-25 57 24 91-1s55 15 89-8" strokeDasharray="5 5" />
          <circle cx="27" cy="73" r="17" />
          <circle cx="117" cy="72" r="17" />
          <circle cx="206" cy="64" r="17" />
          <text x="20" y="79" fill="currentColor" stroke="none" fontSize="17">
            1
          </text>
          <text x="110" y="78" fill="currentColor" stroke="none" fontSize="17">
            2
          </text>
          <text x="199" y="70" fill="currentColor" stroke="none" fontSize="17">
            3
          </text>
          <path d="m193 93 12 8 9-12" />
        </>
      ) : null}

      {variant === 'checklist' ? (
        <>
          <path d="M30 25h93v86H30z" />
          <path d="M56 18h42v15H56z" />
          <path d="m42 51 5 5 9-12m-14 34 5 5 9-12" />
          <path d="M67 52h43M67 79h34" />
          <text x="132" y="52" fill="currentColor" stroke="none" fontSize="16">
            1 cours
          </text>
          <text x="144" y="76" fill="currentColor" stroke="none" fontSize="16">
            = 1 action
          </text>
          <path d="M131 91c26 11 54 9 79-5" />
          <path d="m201 82 9 4-5 9" />
        </>
      ) : null}
    </svg>
  );
}
