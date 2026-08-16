import { Star, CheckCircle2 } from 'lucide-react';

export function Testimonials() {
  const testimonials = [
    {
      id: '1',
      author: 'Mathieu Laurent',
      role: 'Lead Technicien Fibre Optique',
      company: 'Axians Télécom',
      avatarUrl:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80',
      norm: 'Norme ITU-T G.652D',
      quote:
        '« NexoraTech est devenu indispensable sur nos chantiers FTTH. Le calculateur de code couleur et le bilan d’atténuation nous font gagner 30 minutes par dossier de recette client. »',
    },
    {
      id: '2',
      author: 'Sophie Vasseur',
      role: 'Ingénieure Bureau d’Études',
      company: 'SPIE Industrie',
      avatarUrl:
        'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=250&q=80',
      norm: 'Norme UTE C 15-105',
      quote:
        '« La vérification rapide des chutes de tension selon la norme NF C 15-100 directement depuis l’application mobile nous évite toute erreur de dimensionnement sur le terrain. »',
    },
    {
      id: '3',
      author: 'Kévin Moreau',
      role: 'Architecte Réseau & IT',
      company: 'Orange Business',
      avatarUrl:
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80',
      norm: 'RFC 5952 / IEEE 802.3',
      quote:
        '« Le découpage des sous-réseaux IPv6 et la conversion des masques Wildcard ACL sont d’une précision chirurgicale. Un gain de temps massif lors de nos recettes réseau. »',
    },
  ];

  return (
    <section className="py-20 sm:py-28 bg-surface-sunken/30 border-y border-border/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            Retours d&apos;expérience terrain
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Adopté par les experts réseaux & ingénieurs
          </h2>
          <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
            Découvrez comment NexoraTech simplifie les interventions quotidiennes de plus de 10 000 professionnels.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:mt-14 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((item) => (
            <div
              key={item.id}
              className="border-border/80 bg-surface relative flex min-w-0 flex-col justify-between rounded-2xl border p-4 shadow-sm sm:p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
            >
              <div>
                {/* Ligne du haut : 5 Étoiles Dorées + Badge Norme */}
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-1">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Star key={i} className="size-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <span className="rounded-md border border-border bg-surface-sunken px-2.5 py-0.5 font-mono text-2xs font-bold text-muted-foreground">
                    {item.norm}
                  </span>
                </div>

                {/* Citation */}
                <blockquote className="text-xs leading-relaxed text-foreground/90 italic">
                  {item.quote}
                </blockquote>
              </div>

              {/* Ligne du bas : Avatar Photo Client + Nom + Rôle & Entreprise */}
              <div className="mt-6 flex items-center gap-3 pt-4 border-t border-border/50">
                <img
                  src={item.avatarUrl}
                  alt={item.author}
                  className="size-10 rounded-full object-cover ring-2 ring-primary/20 shrink-0 shadow-sm"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-extrabold text-foreground truncate">
                      {item.author}
                    </span>
                    <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                  </div>
                  <p className="text-muted-foreground truncate text-2xs">
                    {item.role} • <span className="font-semibold text-foreground/80">{item.company}</span>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
