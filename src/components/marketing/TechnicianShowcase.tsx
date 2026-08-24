import {
  HardHat,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Activity,
  Signal,
  MapPin,
  FileCheck,
} from 'lucide-react';
import { FIELD_TECHNICIANS } from '@/assets/images/technicianData';

export function TechnicianShowcase() {
  return (
    <section className="relative overflow-hidden border-t border-slate-200/80 bg-slate-50/50 py-20 dark:border-slate-800/80 dark:bg-[#070c18] sm:py-28">
      {/* Halos d'ambiance d'arrière-plan */}
      <div className="pointer-events-none absolute top-1/3 left-1/2 -z-10 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/10 blur-[130px] dark:bg-cyan-500/10" />
      <div className="pointer-events-none absolute -bottom-24 right-10 -z-10 size-80 rounded-full bg-indigo-500/10 blur-[100px]" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* En-tête de section */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-50/80 px-4 py-1.5 text-xs font-bold text-blue-700 shadow-2xs backdrop-blur-md dark:border-cyan-400/30 dark:bg-cyan-950/40 dark:text-cyan-300 mb-4">
            <HardHat className="size-4 text-amber-500 dark:text-amber-400" />
            <span>IMMERSION TERRAIN &amp; SUPERVISION</span>
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl dark:text-white">
            Le SaaS pensé pour{' '}
            <span className="bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 bg-clip-text text-transparent dark:from-cyan-400 dark:via-blue-400 dark:to-indigo-300">
              les pros du terrain
            </span>
          </h2>

          <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300">
            Du raccordement d’infrastructures au pilotage opérationnel en régie : vos équipes disposent d’une synchronisation continue, même hors-ligne.
          </p>
        </div>

        {/* Grille Bento de 3 Cartes Photographiques Haut de Gamme */}
        <div className="mt-14 grid gap-8 lg:grid-cols-3">
          {FIELD_TECHNICIANS.map((tech, idx) => (
            <div
              key={tech.id}
              className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/40 hover:shadow-2xl dark:border-slate-800/90 dark:bg-slate-900/90 dark:shadow-blue-950/20"
            >
              {/* Conteneur Image avec Surcouche Graphique */}
              <div className="relative aspect-4/3 w-full overflow-hidden bg-slate-950">
                <img
                  src={tech.imageUrl}
                  alt={tech.alt}
                  className="size-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                  loading="lazy"
                />

                {/* Voile dégradé progressif pour lisibilité maximale */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />

                {/* Badge télémétrie flottant supérieur */}
                <div className="absolute top-3.5 left-3.5 flex items-center gap-2 rounded-full border border-white/20 bg-slate-900/85 px-3 py-1 text-2xs font-bold text-white shadow-md backdrop-blur-md">
                  {idx === 0 && <Signal className="size-3 text-cyan-400 animate-pulse" />}
                  {idx === 1 && <Activity className="size-3 text-emerald-400 animate-pulse" />}
                  {idx === 2 && <ShieldCheck className="size-3 text-amber-400" />}
                  <span>{tech.badge}</span>
                </div>

                {/* Puce statut PWA Hors-ligne / En direct */}
                <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/85 px-2.5 py-1 text-3xs font-bold text-emerald-300 shadow-md backdrop-blur-md">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>SYNCHRO PWA</span>
                </div>

                {/* Localisation et Identité en bas de l'image */}
                <div className="absolute right-4 bottom-3.5 left-4 text-white">
                  <div className="flex items-center gap-1.5 text-3xs font-mono font-bold tracking-wider text-cyan-300 uppercase">
                    <MapPin className="size-3 text-cyan-400" />
                    <span>{tech.location}</span>
                  </div>
                  <h3 className="mt-0.5 flex items-center gap-1.5 text-base font-bold text-white">
                    {tech.name}
                    <Sparkles className="size-3.5 text-amber-400" />
                  </h3>
                </div>
              </div>

              {/* Corps de la carte */}
              <div className="flex flex-1 flex-col justify-between space-y-4 p-5 sm:p-6">
                <div>
                  <div className="inline-block rounded-md bg-blue-50 px-2.5 py-0.5 text-2xs font-bold text-blue-700 dark:bg-blue-950/60 dark:text-cyan-300">
                    {tech.role}
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-slate-600 italic dark:text-slate-300">
                    &ldquo;{tech.quote}&rdquo;
                  </p>
                </div>

                {/* Pied de carte avec certification & état */}
                <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-2xs font-medium text-slate-500 dark:border-slate-800/80 dark:text-slate-400">
                  <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                    <CheckCircle2 className="size-3.5" />
                    Fiche d’intervention signée
                  </span>
                  <span className="flex items-center gap-1 font-mono text-3xs">
                    <FileCheck className="size-3 text-slate-400" />
                    PDF Horodaté
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
