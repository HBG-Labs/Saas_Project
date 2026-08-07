import { Link } from 'react-router';

import { ROUTES } from '@/config/routes';

export default function HomePage() {
  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          Nexora<span className="text-brand-600">Tech</span>
        </h1>
        <p className="text-content-muted max-w-prose">
          Boîte à outils technique pour les professionnels de la fibre optique, des réseaux et de
          l&apos;électricité.
        </p>
      </div>

      <Link
        to={ROUTES.tools}
        className="bg-brand-600 min-h-touch hover:bg-brand-700 inline-flex items-center rounded-md px-4 text-sm font-medium text-white transition-colors"
      >
        Parcourir les outils
      </Link>
    </section>
  );
}
