import { Laptop, Smartphone, Tablet } from 'lucide-react';

export function FieldSupport() {
  return (
    <section className="border-y border-slate-200/80 bg-white py-20 dark:border-slate-800/80 dark:bg-slate-950 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 items-center lg:grid-cols-2">
          {/* Texte explicatif */}
          <div className="space-y-6">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Mobilité & Terrain
            </h2>
            <h3 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
              Votre activité vous suit partout.
            </h3>
            <p className="text-base leading-relaxed text-slate-600 dark:text-slate-400">
              Accédez à vos informations et outils depuis votre bureau ou directement sur le terrain. Que vous soyez sur un ordinateur portable, une tablette de chantier ou votre smartphone, l&apos;interface s&apos;adapte instantanément.
            </p>

            <div className="space-y-4 pt-2">
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                  <Laptop className="size-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Au bureau (Desktop & Mac)</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Pilotage complet de l&apos;entreprise, gestion des rôles, facturation et vue globale.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                  <Tablet className="size-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Sur chantier (Tablette)</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Saisie fluide des rapports d&apos;intervention et calculs techniques rapides.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-violet-50 p-2.5 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400">
                  <Smartphone className="size-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">En mobilité (Smartphone iOS & Android)</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Consultation du planning du jour et mise à jour des statuts en 1 tap.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Illustration visuelle multi-appareils */}
          <div className="relative mx-auto w-full max-w-lg rounded-3xl border border-slate-200/80 bg-slate-50/50 p-6 shadow-xl dark:border-slate-800/80 dark:bg-slate-900/50">
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-2xs dark:bg-slate-900">
                <div className="flex items-center gap-3">
                  <span className="size-3 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Interface Mobile Réactive</span>
                </div>
                <span className="font-mono text-2xs text-slate-400">iOS / Android</span>
              </div>

              <div className="rounded-2xl border border-slate-200/60 bg-white p-4 space-y-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  Mission active : Raccordement Siège BNP
                </div>
                <div className="flex items-center justify-between text-2xs text-slate-500">
                  <span>Statut : En cours</span>
                  <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">13:30 - 15:30</span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/60 bg-white p-4 space-y-2 dark:border-slate-800 dark:bg-slate-900">
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  Calculatrice Fibre Express
                </div>
                <div className="text-2xs text-slate-500">Atténuation totale : −14.82 dB</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
