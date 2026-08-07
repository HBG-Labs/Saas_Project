import { Link } from 'react-router';

import { ROUTES } from '@/config/routes';

export default function NotFoundPage() {
  return (
    <section className="space-y-4">
      <p className="text-brand-600 text-sm font-medium">Erreur 404</p>
      <h1 className="text-2xl font-semibold tracking-tight">Page introuvable</h1>
      <p className="text-content-muted max-w-prose text-sm">
        La page demandée n&apos;existe pas ou a été déplacée.
      </p>
      <Link to={ROUTES.home} className="text-brand-600 inline-block text-sm underline">
        Retour à l&apos;accueil
      </Link>
    </section>
  );
}
