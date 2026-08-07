interface PagePlaceholderProps {
  title: string;
  description: string;
  /** Phase à laquelle le contenu réel sera développé. */
  plannedFor?: string;
}

/**
 * Coquille de page.
 *
 * Les pages de la Phase 1 n'existent que pour prouver que le routing, la
 * protection des routes et le découpage du bundle fonctionnent. Les factoriser
 * ici évite de dupliquer quatorze fois la même structure, et rend explicite ce
 * qui reste à construire.
 */
export function PagePlaceholder({ title, description, plannedFor }: PagePlaceholderProps) {
  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-content-muted max-w-prose text-sm">{description}</p>

      {plannedFor ? (
        <p className="border-border text-content-muted inline-block rounded-md border border-dashed px-3 py-1.5 text-xs">
          Contenu prévu en {plannedFor}
        </p>
      ) : null}
    </section>
  );
}
