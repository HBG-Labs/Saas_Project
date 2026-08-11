import { Activity, CheckCircle2, Cpu, GitMerge, RefreshCw, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';

export function FeaturesBento() {
  return (
    <section className="relative border-t border-border/60 px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        {/* Titre & Sous-titre Bento */}
        <div className="text-center mb-16">
          <span className="text-primary text-xs font-bold uppercase tracking-wider">
            Fonctionnalités Clés
          </span>
          <h2 className="text-foreground mt-2 text-3xl font-extrabold tracking-tight sm:text-5xl">
            Tout ce dont vous avez besoin pour évoluer
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-base sm:text-lg">
            Des outils puissants conçus pour offrir à vos techniciens et ingénieurs l&apos;avantage décisif dans des environnements exigeants.
          </p>
        </div>

        {/* Bento Grid 12 colonnes responsive */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* ------------------------------------------------------- Feature 1 (Large 8 cols) */}
          <div className="md:col-span-8 bg-surface-raised rounded-3xl p-8 border border-border/80 shadow-raised relative overflow-hidden group hover:border-primary/40 hover:shadow-overlay transition-all duration-300">
            <div className="absolute top-0 right-0 size-64 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-primary/10 transition-colors" />

            <div className="relative z-10 flex flex-col h-full justify-between space-y-8">
              <div>
                <div className="size-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Activity className="size-6" />
                </div>
                <h3 className="text-foreground text-2xl font-bold mb-2">Surveillance & Mesures en Temps Réel</h3>
                <p className="text-muted-foreground text-sm max-w-md leading-relaxed">
                  Obtenez une visibilité instantanée sur l&apos;ensemble de vos calculs optiques, réseau et électriques. Votre cockpit centralise vos métriques dans une vue unifiée.
                </p>
              </div>

              {/* Graphique interactif de performance */}
              <div className="bg-surface-sunken border border-border/60 rounded-2xl p-5 shadow-inner flex items-end gap-2 h-44 w-full">
                <div className="w-1/6 bg-primary/20 rounded-t-lg h-[40%] hover:bg-primary transition-all duration-300 cursor-pointer" title="Échantillon 1 : 40%" />
                <div className="w-1/6 bg-primary/40 rounded-t-lg h-[60%] hover:bg-primary transition-all duration-300 cursor-pointer" title="Échantillon 2 : 60%" />
                <div className="w-1/6 bg-primary/60 rounded-t-lg h-[35%] hover:bg-primary transition-all duration-300 cursor-pointer" title="Échantillon 3 : 35%" />
                <div className="w-1/6 bg-primary/80 rounded-t-lg h-[80%] hover:bg-primary transition-all duration-300 cursor-pointer" title="Échantillon 4 : 80%" />
                <div className="w-1/6 bg-primary rounded-t-lg h-[100%] hover:bg-primary-hover transition-all duration-300 cursor-pointer animate-pulse" title="Pic d'intervention : 100%" />
                <div className="w-1/6 bg-primary/70 rounded-t-lg h-[75%] hover:bg-primary transition-all duration-300 cursor-pointer" title="Échantillon 6 : 75%" />
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------- Feature 2 (4 cols) */}
          <div className="md:col-span-4 bg-surface-raised rounded-3xl p-8 border border-border/80 shadow-raised relative overflow-hidden group hover:border-primary/40 hover:shadow-overlay transition-all duration-300 flex flex-col justify-between">
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div>
                <div className="size-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <GitMerge className="size-6" />
                </div>
                <h3 className="text-foreground text-xl font-bold mb-2">Workflows Automatisés</h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                  Configurez des règles de validation complexes sans écrire une seule ligne de code.
                </p>
              </div>

              <div className="space-y-3 pt-4">
                <div className="flex items-center gap-3 p-3.5 rounded-xl border border-success/30 bg-success/10 text-success shadow-xs">
                  <CheckCircle2 className="size-4 shrink-0" />
                  <span className="text-xs font-semibold">Détection de conformité ISO</span>
                </div>
                <div className="w-px h-4 bg-border/80 mx-auto" />
                <div className="flex items-center gap-3 p-3.5 rounded-xl border border-border/60 bg-surface-sunken opacity-80">
                  <RefreshCw className="size-4 text-primary animate-spin-slow shrink-0" />
                  <span className="text-xs font-medium text-foreground">Calcul en cours d&apos;exécution</span>
                </div>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------- Feature 3 (4 cols) */}
          <div className="md:col-span-4 bg-surface-raised rounded-3xl p-8 border border-border/80 shadow-raised relative overflow-hidden group hover:border-primary/40 hover:shadow-overlay transition-all duration-300">
            <div className="relative z-10">
              <div className="size-12 rounded-xl bg-info/10 text-info flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <ShieldCheck className="size-6" />
              </div>
              <h3 className="text-foreground text-xl font-bold mb-2">Collaboration d&apos;Équipe</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Conçu pour les équipes. Partagez vos paramètres de calcul, attribuez les projets et validez les rapports d&apos;intervention en temps réel.
              </p>
            </div>
          </div>

          {/* ------------------------------------------------------- Feature 4 (Large CTA Banner 8 cols) */}
          <div className="md:col-span-8 bg-gradient-to-r from-primary via-primary-600 to-accent rounded-3xl p-8 text-primary-foreground shadow-modal relative overflow-hidden group">
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between h-full gap-8">
              <div className="max-w-md text-left">
                <h3 className="text-white text-2xl font-black mb-3">Prêt à prendre le contrôle ?</h3>
                <p className="text-white/90 text-sm leading-relaxed mb-6">
                  Rejoignez des milliers de techniciens et d&apos;ingénieurs qui utilisent NexoraTech pour piloter leur infrastructure technique.
                </p>
                <Button asChild size="md" variant="secondary" className="bg-white text-primary hover:bg-white/90 font-bold shadow-md">
                  <Link to={ROUTES.register}>Démarrer un essai gratuit</Link>
                </Button>
              </div>

              <div className="hidden md:flex size-44 rounded-full border-8 border-white/20 items-center justify-center group-hover:scale-105 transition-transform">
                <Cpu className="size-20 text-white" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
