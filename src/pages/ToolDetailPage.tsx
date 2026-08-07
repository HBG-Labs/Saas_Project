import { Suspense } from 'react';
import { Link, useParams } from 'react-router';

import { LoadingScreen } from '@/components/feedback/LoadingScreen';
import { ROUTES } from '@/config/routes';
import { getTool, ToolErrorBoundary } from '@/features/tools';

/**
 * Affiche un outil du registry.
 *
 * Trois garanties structurelles se rejoignent ici :
 *   • `Suspense` gère le téléchargement du composant, chargé paresseusement ;
 *   • `ToolErrorBoundary` confine un éventuel crash à cette zone — l'en-tête,
 *     la navigation et le routing restent intacts ;
 *   • un slug inconnu produit un message clair plutôt qu'un écran blanc.
 */
export default function ToolDetailPage() {
  const { toolSlug } = useParams<{ toolSlug: string }>();
  const tool = toolSlug ? getTool(toolSlug) : undefined;

  if (!tool) {
    return (
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Outil introuvable</h1>
        <p className="text-content-muted text-sm">Aucun outil ne correspond à « {toolSlug} ».</p>
        <Link to={ROUTES.tools} className="text-brand-600 inline-block text-sm underline">
          Voir tous les outils
        </Link>
      </section>
    );
  }

  const { Component } = tool;

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{tool.title}</h1>
        <p className="text-content-muted text-sm">{tool.description}</p>
      </header>

      <ToolErrorBoundary toolSlug={tool.slug} toolTitle={tool.title}>
        <Suspense fallback={<LoadingScreen variant="inline" label="Chargement de l’outil…" />}>
          <Component />
        </Suspense>
      </ToolErrorBoundary>
    </section>
  );
}
