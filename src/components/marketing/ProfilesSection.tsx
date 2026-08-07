import { Wrench, Briefcase, GraduationCap, Building2 } from 'lucide-react';

const PROFILES = [
  {
    icon: Wrench,
    role: 'Techniciens de terrain',
    benefit: 'Validation rapide des liaisons et câblages',
    details: 'Vérifiez la conformité des niveaux de puissance optique et des chutes de tension directement lors du raccordement client.',
  },
  {
    icon: Briefcase,
    role: 'Ingénieurs d\'études',
    benefit: 'Bilans de réseau et calculs de dimensionnement',
    details: 'Concevez vos architectures réseau et électriques avec des formules certifiées sans avoir à créer de feuilles de calcul ad-hoc.',
  },
  {
    icon: GraduationCap,
    role: 'Étudiants & Formateurs',
    benefit: 'Compréhension et application des formules',
    details: 'Visualisez clairement le rôle de chaque variable et vérifiez vos exercices pratiques avec des explications d\'unités intégrées.',
  },
  {
    icon: Building2,
    role: 'Entreprises & Équipes',
    benefit: 'Standardisation des outils de travail',
    details: 'Offrez à l’ensemble de vos équipes techniques un socle d’outils unifié pour garantir l’homogénéité des méthodes de calcul.',
  },
] as const;

export function ProfilesSection() {
  return (
    <section className="relative border-t border-border/60 bg-surface-sunken/30 px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <span className="text-accent text-xs font-semibold uppercase tracking-wider">
            Cas d&apos;usage
          </span>
          <h2 className="text-foreground mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Une plateforme adaptée à chaque profil technique
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-base">
            Que vous soyez sur le terrain, au bureau ou en formation, NexoraTech répond à vos besoins spécifiques.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PROFILES.map((profile) => {
            const Icon = profile.icon;
            return (
              <div
                key={profile.role}
                className="bg-surface border-border/60 hover:border-accent/50 shadow-raised rounded-xl border p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="bg-accent/10 text-accent flex size-10 items-center justify-center rounded-lg">
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                  <h3 className="text-foreground mt-4 font-semibold text-base">{profile.role}</h3>
                  <p className="text-primary font-medium text-xs mt-1">{profile.benefit}</p>
                  <p className="text-muted-foreground text-xs mt-3 leading-relaxed">{profile.details}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
