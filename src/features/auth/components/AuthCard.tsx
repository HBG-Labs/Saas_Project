import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { Logo } from '@/components/layout/Logo';
import { ROUTES } from '@/config/routes';

interface AuthCardProps {
  title: string;
  description: string;
  children: ReactNode;
  /** Lien de bas de carte, ex. « Pas encore de compte ? ». */
  footer?: ReactNode;
}

export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <div className="relative flex items-start justify-center px-4 py-8 sm:min-h-[calc(100dvh-4rem)] sm:items-center sm:py-12">
      {/* Fond motif grille technique */}
      <div
        className="bg-tech-grid pointer-events-none absolute inset-0 -z-10 opacity-30"
        aria-hidden="true"
      />

      <div className="w-full max-w-md">
        <div className="mb-6 text-center sm:mb-8">
          <div className="inline-block">
            <Logo className="text-2xl" to={ROUTES.home} />
          </div>
          <h1 className="text-foreground mt-4 text-2xl font-extrabold tracking-tight sm:mt-6 sm:text-3xl">
            {title}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">{description}</p>
        </div>

        <div className="bg-surface/90 border-border/80 shadow-modal rounded-2xl border p-6 sm:p-8">
          {children}
        </div>

        {footer ? (
          <div className="text-muted-foreground mt-6 text-center text-sm">{footer}</div>
        ) : null}

        <p className="text-subtle-foreground mt-6 text-center text-xs sm:mt-8">
          <Link to={ROUTES.home} className="hover:text-foreground font-medium transition-colors">
            ← Retour à l&apos;accueil
          </Link>
        </p>
      </div>
    </div>
  );
}
