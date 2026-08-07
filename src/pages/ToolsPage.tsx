import { Link } from 'react-router';

import { listTools } from '@/features/tools';
import { ROUTES } from '@/config/routes';

/**
 * Catalogue des outils enregistrés.
 *
 * Lit le registry, pas une liste écrite en dur : dès qu'un dossier sera ajouté
 * dans `src/tools/`, il apparaîtra ici sans modifier cette page.
 */
export default function ToolsPage() {
  const tools = listTools();

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Outils</h1>

      {tools.length === 0 ? (
        <div className="border-border text-content-muted rounded-lg border border-dashed p-8 text-center text-sm">
          <p className="font-medium">Aucun outil enregistré pour le moment.</p>
          <p className="mt-1">
            Les outils fibre, réseau et électricité seront développés dans les phases suivantes.
            L&apos;architecture d&apos;accueil est en place.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <li key={tool.slug}>
              <Link
                to={ROUTES.tool(tool.slug)}
                className="border-border hover:border-brand-500 block h-full rounded-lg border p-4 transition-colors"
              >
                <h2 className="font-medium">{tool.title}</h2>
                <p className="text-content-muted mt-1 text-sm">{tool.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
