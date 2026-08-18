import { CheckCircle2, FlaskConical, Ruler, ShieldCheck } from 'lucide-react';

/**
 * Ce que l'outil garantit — et rien d'autre.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI IL N'Y A PLUS DE TÉMOIGNAGES ICI
 *
 * Cette section présentait trois avis clients. Aucun n'existait : personnes
 * inventées, portraits tirés d'une banque d'images, et surtout des citations
 * attribuées à des ENTREPRISES RÉELLES — Axians, SPIE, Orange Business — qui
 * n'ont jamais rien dit de ce produit. Elle annonçait aussi « plus de 10 000
 * professionnels » pour une base qui en compte seize.
 *
 * Ce n'était pas une exagération commerciale, c'était une attribution
 * mensongère. Le jour où un prospect reconnaît l'une de ces marques et
 * vérifie, c'est toute la crédibilité du produit qui part avec — sans parler du
 * risque juridique.
 *
 * Le remplacement ne dit que des choses vérifiables dans ce dépôt : le nombre
 * d'outils, les normes réellement implémentées, la couverture de tests. Un
 * acheteur technique y trouvera plus de raisons de faire confiance que dans
 * trois éloges anonymes.
 *
 * Les vrais témoignages viendront des premiers clients. En attendant, mieux
 * vaut une page qui ne promet rien qu'une page qui promet faux.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const GARANTIES = [
  {
    id: 'normes',
    icon: Ruler,
    title: 'Des calculs adossés aux normes',
    body:
      'Adressage et sous-réseaux conformes aux RFC 5952, 4193 et 1035 ; débits et trames selon IEEE 802.3. Chaque outil cite la référence qu’il applique, à l’écran.',
  },
  {
    id: 'tests',
    icon: FlaskConical,
    title: 'Vérifiés, pas seulement écrits',
    body:
      'Les calculatrices sont couvertes par des tests automatisés rejoués à chaque modification. Un résultat qui change sans qu’on l’ait décidé fait échouer la publication.',
  },
  {
    id: 'donnees',
    icon: ShieldCheck,
    title: 'Vos données restent les vôtres',
    body:
      'Chaque entreprise est isolée au niveau de la base, par des règles appliquées par PostgreSQL — pas par l’interface. Une organisation ne peut pas lire les données d’une autre, même en forgeant la requête.',
  },
];

export function Testimonials() {
  return (
    <section className="py-20 sm:py-28 bg-surface-sunken/30 border-y border-border/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            Ce sur quoi vous pouvez compter
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Dix-huit outils, et la manière dont ils sont tenus
          </h2>
          <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
            NexoraTech est un jeune produit. Plutôt que des éloges, voici ce qui se vérifie.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:mt-14 sm:gap-6 md:grid-cols-3">
          {GARANTIES.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.id}
                className="border-border/80 bg-surface flex min-w-0 flex-col gap-3 rounded-2xl border p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md sm:p-6"
              >
                <div className="bg-primary/10 text-primary border-primary/20 flex size-10 items-center justify-center rounded-xl border">
                  <Icon className="size-5" aria-hidden="true" />
                </div>

                <h3 className="text-foreground text-base font-bold">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{item.body}</p>
              </div>
            );
          })}
        </div>

        <p className="text-subtle-foreground mt-8 flex items-center justify-center gap-1.5 text-center text-xs">
          <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
          Aucun témoignage sur cette page n’est inventé : il n’y en a pas encore.
        </p>
      </div>
    </section>
  );
}
