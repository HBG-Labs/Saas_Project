const TECHNOLOGIES = [
  {
    name: 'GitHub',
    src: '/images/brands/github.svg',
    className: 'lp-technology-logo--github',
  },
  {
    name: 'Vercel',
    src: '/images/brands/vercel.svg',
    className: 'lp-technology-logo--vercel',
  },
  {
    name: 'Supabase',
    src: '/images/brands/supabase.svg',
    className: 'lp-technology-logo--supabase',
  },
  {
    name: 'Stripe',
    src: '/images/brands/stripe.svg',
    className: 'lp-technology-logo--stripe',
  },
  {
    name: 'OpenAI',
    src: '/images/brands/openai.svg',
    className: 'lp-technology-logo--openai',
  },
  {
    name: 'SuperPDP',
    src: '/images/brands/superpdp.svg',
    className: 'lp-technology-logo--superpdp',
  },
] as const;

function TechnologyGroup({ duplicate = false }: { duplicate?: boolean }) {
  return (
    <ul className="lp-technology-group" aria-hidden={duplicate || undefined}>
      {TECHNOLOGIES.map((technology) => (
        <li className="lp-technology-item" key={technology.name}>
          <img
            className={`lp-technology-logo ${technology.className}`}
            src={technology.src}
            alt={duplicate ? '' : technology.name}
            width="180"
            height="48"
            loading="lazy"
            decoding="async"
          />
        </li>
      ))}
    </ul>
  );
}

export function TechnologyMarquee() {
  return (
    <section className="lp-technologies" aria-labelledby="lp-technologies-title">
      <div className="lp-container lp-technologies-heading" data-reveal>
        <p className="lp-technologies-kicker">Technologies et intégrations</p>
        <h2 id="lp-technologies-title">REZO360 s’appuie sur des technologies de confiance</h2>
      </div>

      <div className="lp-technology-viewport" data-reveal>
        <div className="lp-technology-track">
          <TechnologyGroup />
          <TechnologyGroup duplicate />
        </div>
      </div>
    </section>
  );
}
