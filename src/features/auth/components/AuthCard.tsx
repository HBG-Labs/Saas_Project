import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router';

import { Logo } from '@/components/layout/Logo';
import { ROUTES } from '@/config/routes';
import '@/styles/auth-alive.css';
import { useAuthPhotograph } from './auth-photographs';

interface AuthCardProps {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
  variant?: 'login' | 'register';
}

/** Presentation only: authentication and validation stay in each page. */
export function AuthCard({
  title,
  description,
  children,
  footer,
  variant = 'login',
}: AuthCardProps) {
  const isRegistration = variant === 'register';
  const photograph = useAuthPhotograph();

  return (
    <div className={`auth-alive auth-alive--${variant}`}>
      <section className="auth-alive__panel" aria-labelledby="auth-title">
        <header className="auth-alive__brand">
          <Logo to={ROUTES.home} />
          <Link className="auth-alive__home" to={ROUTES.home}>
            Retour à l’accueil <span aria-hidden="true">↗</span>
          </Link>
        </header>

        <div className="auth-alive__content">
          <div className="auth-alive__intro">
            <p className="auth-alive__eyebrow">
              {isRegistration ? 'Votre activité commence ici' : 'Votre espace de travail'}
            </p>
            <h1 id="auth-title">{title}</h1>
            <p className="auth-alive__description">{description}</p>
          </div>

          <div className="auth-alive__form">{children}</div>
          {footer ? <div className="auth-alive__switch">{footer}</div> : null}
        </div>

        <footer className="auth-alive__help">
          <span>Une question ?</span>
          <a href="mailto:contact@rezo360.fr">
            Contactez-nous <span aria-hidden="true">↗</span>
          </a>
        </footer>
      </section>

      <figure
        className="auth-alive__visual"
        style={{ '--auth-photo-position': photograph.position } as CSSProperties}
      >
        <picture>
          <source media="(max-width: 900px)" srcSet={`/images/auth/${photograph.id}-800.webp`} />
          <img
            src={`/images/auth/${photograph.id}-1536.webp`}
            width="1536"
            height="1024"
            alt=""
            decoding="async"
          />
        </picture>
        <figcaption className="auth-alive__caption">
          <p className="auth-alive__scene-label">REZO360 · Au plus près du terrain</p>
          <p className="auth-alive__scene-title">
            {isRegistration ? (
              <>
                Une nouvelle journée.
                <br />
                De nouvelles possibilités.
              </>
            ) : (
              <>
                Votre journée reprend.
                <br />
                Tout est à sa place.
              </>
            )}
          </p>
          <p className="auth-alive__scene-signature">Votre activité en mieux. Tout simplement.</p>
        </figcaption>
      </figure>
    </div>
  );
}
