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

/**
 * Enveloppe commune aux écrans d'authentification.
 *
 * Factorisée pour que connexion, inscription et mot de passe oublié partagent
 * exactement la même mise en page : trois variantes légèrement différentes
 * donneraient une impression d'inachevé au moment précis où l'on demande sa
 * confiance à l'utilisateur.
 */
export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Logo className="text-xl" to={ROUTES.home} />
          <h1 className="mt-6 text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground mt-2 text-sm">{description}</p>
        </div>

        <div className="bg-surface border-border shadow-raised rounded-xl border p-6">
          {children}
        </div>

        {footer ? (
          <div className="text-muted-foreground mt-6 text-center text-sm">{footer}</div>
        ) : null}

        <p className="text-subtle-foreground mt-8 text-center text-xs">
          <Link to={ROUTES.home} className="hover:text-foreground transition-colors">
            ← Retour à l&apos;accueil
          </Link>
        </p>
      </div>
    </div>
  );
}
