import { HardHat, ShieldCheck, CheckCircle2, Sparkles } from 'lucide-react';
import { FIELD_TECHNICIANS } from '@/assets/images/technicianData';

export function TechnicianShowcase() {
  return (
    <section className="relative overflow-hidden border-t border-border/60 bg-gradient-to-b from-surface/40 via-surface-sunken/40 to-surface/40 px-4 py-20 sm:px-6 sm:py-28">
      {/* Effets lumineux de fond */}
      <div className="absolute top-1/2 left-1/2 -z-10 size-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-warning/30 bg-warning/10 px-3.5 py-1 text-2xs font-semibold text-warning shadow-xs mb-4">
            <HardHat className="size-3.5 text-warning" />
            Équipements & Casques de Sécurité Certifiés
          </div>

          <h2 className="text-foreground text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
            Conçu pour les techniciens{' '}
            <span className="from-primary via-primary-600 to-accent bg-gradient-to-r bg-clip-text text-transparent">
              en intervention terrain
            </span>
          </h2>

          <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-base sm:text-lg">
            Sur le chantier, en baie de brassage ou en datacenter : vos outils de calcul certifiés restent toujours à portée de main.
          </p>
        </div>

        {/* Grille de cartes visuelles avec les photos des techniciens */}
        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {FIELD_TECHNICIANS.map((tech) => (
            <div
              key={tech.id}
              className="group relative overflow-hidden rounded-2xl border border-border/70 bg-surface shadow-raised transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-modal flex flex-col justify-between"
            >
              {/* Image du technicien avec casque */}
              <div className="relative aspect-4/3 w-full overflow-hidden bg-surface-sunken">
                <img
                  src={tech.imageUrl}
                  alt={tech.alt}
                  className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

                {/* Badge casque sur la photo */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 px-2.5 py-1 text-2xs font-medium text-white shadow-md">
                  <ShieldCheck className="size-3 text-emerald-400" />
                  <span>{tech.badge}</span>
                </div>

                {/* Titre & Localisation sur l'image */}
                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <span className="text-2xs font-mono text-primary-200 uppercase tracking-wider block">
                    {tech.location}
                  </span>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1">
                    {tech.name}
                    <Sparkles className="size-3 text-amber-400" />
                  </h3>
                </div>
              </div>

              {/* Contenu textuel et citation */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <p className="text-xs font-semibold text-primary">{tech.role}</p>
                  <p className="mt-3 text-xs text-muted-foreground italic leading-relaxed">
                    &ldquo;{tech.quote}&rdquo;
                  </p>
                </div>

                <div className="pt-3 border-t border-border/50 flex items-center justify-between text-2xs text-subtle-foreground">
                  <span className="flex items-center gap-1 text-success font-medium">
                    <CheckCircle2 className="size-3" />
                    Utilisation validée
                  </span>
                  <span className="font-mono">Standard NF/ITU</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
