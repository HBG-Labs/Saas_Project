import { Section } from './Section';

/**
 * Emplacements de témoignages.
 *
 * ⚠️ Contenu VOLONTAIREMENT fictif et signalé comme tel. Aucun avis client réel
 * n'existe à ce stade du produit, et fabriquer des témoignages crédibles —
 * noms complets, entreprises identifiables, citations plausibles — reviendrait
 * à produire de faux avis, y compris sur une maquette.
 *
 * Les personas sont donc désignés par un métier et un secteur, sans identité,
 * et un avertissement explicite accompagne la section. À remplacer par de vrais
 * témoignages recueillis avec autorisation.
 */
const PLACEHOLDERS = [
  {
    id: 'a',
    quote:
      'Emplacement réservé — témoignage à recueillir auprès d’un technicien fibre après la mise en service.',
    role: 'Technicien fibre optique',
    sector: 'Opérateur télécom',
  },
  {
    id: 'b',
    quote:
      'Emplacement réservé — témoignage à recueillir auprès d’un ingénieur réseau après la mise en service.',
    role: 'Ingénieur réseau',
    sector: 'Intégrateur',
  },
  {
    id: 'c',
    quote:
      'Emplacement réservé — témoignage à recueillir auprès d’un formateur après la mise en service.',
    role: 'Formateur',
    sector: 'Centre de formation',
  },
] as const;

export function Testimonials() {
  return (
    <Section eyebrow="Témoignages" title="Ce qu’en diront les utilisateurs">
      <p className="border-warning-border bg-warning-subtle text-foreground mb-8 rounded-lg border px-4 py-3 text-sm">
        <strong className="font-semibold">Section à compléter.</strong> Ces encarts sont des
        emplacements de mise en page. Aucun témoignage réel n&apos;a encore été recueilli — ils
        seront remplacés par de vrais retours, avec l&apos;accord de leurs auteurs.
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        {PLACEHOLDERS.map((item) => (
          <figure
            key={item.id}
            className="border-border bg-surface rounded-lg border border-dashed p-5"
          >
            <blockquote className="text-muted-foreground text-sm italic">{item.quote}</blockquote>
            <figcaption className="text-subtle-foreground mt-4 flex items-center gap-2.5 text-xs">
              <span className="bg-surface-hover size-8 rounded-full" aria-hidden="true" />
              <span>
                <span className="text-foreground block font-medium">{item.role}</span>
                {item.sector}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}
