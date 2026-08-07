import { ArrowRight, Cable, CheckCircle2, Cpu, Network, Search, Sparkles, Zap } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Kbd } from '@/components/ui/Kbd';
import { ROUTES } from '@/config/routes';

type DemoTab = 'fiber' | 'network' | 'electrical';

export function Hero() {
  const [activeTab, setActiveTab] = useState<DemoTab>('fiber');

  return (
    <section className="relative overflow-hidden px-4 pt-12 pb-24 sm:px-6 sm:pt-20 sm:pb-32">
      {/* Motifs de fond techniques & lueurs ambiantes */}
      <div className="bg-tech-grid pointer-events-none absolute inset-0 -z-10 opacity-40" aria-hidden="true" />
      <div
        aria-hidden="true"
        className="from-primary/10 via-accent/5 pointer-events-none absolute -top-40 left-1/2 -z-10 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-b to-transparent blur-3xl"
      />

      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary mb-6 gap-2 py-1 px-3 text-xs">
            <Sparkles className="size-3.5 text-accent animate-pulse" />
            Espace de travail technique nouvelle génération
          </Badge>

          <h1 className="text-foreground text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
            Tous vos outils techniques.{' '}
            <span className="from-primary via-primary-600 to-accent bg-gradient-to-r bg-clip-text text-transparent">
              Un seul cockpit.
            </span>
          </h1>

          <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg sm:text-xl">
            Calculs d&apos;atténuation optique, adressage sous-réseau IPv4/v6, bilans électriques UTE et convertisseurs.
            Résultats instantanés, précis et sauvegardés sur le terrain comme au bureau.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button asChild size="lg" className="glow-primary group w-full sm:w-auto">
              <Link to={ROUTES.register}>
                Commencer gratuitement
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
              <Link to={ROUTES.tools}>Explorer le catalogue</Link>
            </Button>
          </div>

          <div className="text-subtle-foreground mt-6 flex items-center justify-center gap-2 text-xs">
            <Search className="size-3.5" />
            <span>Accès rapide universel :</span>
            <Kbd>⌘</Kbd> <Kbd>K</Kbd>
          </div>
        </div>

        {/* ------------------------------------------------------- Cockpit Live Mockup */}
        <div className="mt-14 sm:mt-20">
          <div className="bg-surface/90 border-border border-glow shadow-modal rounded-2xl border p-4 sm:p-6 backdrop-blur-xl">
            {/* Barre de titre fenêtre */}
            <div className="border-border/60 mb-6 flex flex-wrap items-center justify-between gap-4 border-b pb-4">
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-full bg-red-500/80" />
                <span className="size-3 rounded-full bg-yellow-500/80" />
                <span className="size-3 rounded-full bg-green-500/80" />
                <span className="text-muted-foreground ml-3 text-xs font-medium font-mono">
                  nexora-cockpit // v0.2.0
                </span>
              </div>

              {/* Onglets interactifs de la démo */}
              <div className="bg-surface-sunken flex items-center rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('fiber')}
                  className={`flex items-center gap-2 rounded-md px-3 py-1 text-xs font-medium transition-all ${
                    activeTab === 'fiber' ? 'bg-surface text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Cable className="size-3.5 text-primary" />
                  Bilan Optique
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('network')}
                  className={`flex items-center gap-2 rounded-md px-3 py-1 text-xs font-medium transition-all ${
                    activeTab === 'network' ? 'bg-surface text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Network className="size-3.5 text-accent" />
                  Sous-réseau IP
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('electrical')}
                  className={`flex items-center gap-2 rounded-md px-3 py-1 text-xs font-medium transition-all ${
                    activeTab === 'electrical' ? 'bg-surface text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Zap className="size-3.5 text-warning" />
                  Puissance Triphasée
                </button>
              </div>
            </div>

            {/* Contenu du mockup selon l'onglet choisi */}
            {activeTab === 'fiber' && (
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-4 lg:col-span-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-foreground text-base font-semibold">Calculateur d&apos;atténuation de liaison FTTH</h3>
                      <p className="text-muted-foreground text-xs">Standard ITU-T G.652.D / 1310 nm & 1550 nm</p>
                    </div>
                    <Badge variant="success" className="gap-1 text-2xs">
                      <CheckCircle2 className="size-3" />
                      Conforme ISO/IEC 11801
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="bg-surface-sunken rounded-lg p-3 border border-border/50">
                      <span className="text-subtle-foreground text-2xs block">Longueur fibre</span>
                      <span className="font-mono text-sm font-semibold text-foreground">12.45 km</span>
                    </div>
                    <div className="bg-surface-sunken rounded-lg p-3 border border-border/50">
                      <span className="text-subtle-foreground text-2xs block">Nb. épissures</span>
                      <span className="font-mono text-sm font-semibold text-foreground">8 (0.05 dB/u)</span>
                    </div>
                    <div className="bg-surface-sunken rounded-lg p-3 border border-border/50">
                      <span className="text-subtle-foreground text-2xs block">Nb. connecteurs</span>
                      <span className="font-mono text-sm font-semibold text-foreground">4 SC/APC</span>
                    </div>
                  </div>

                  <div className="bg-surface-sunken/60 rounded-xl p-4 border border-border/40">
                    <div className="flex items-center justify-between text-xs text-subtle-foreground mb-2">
                      <span>Profil d&apos;atténuation linéique</span>
                      <span className="font-mono text-primary">0.35 dB/km @ 1310nm</span>
                    </div>
                    <div className="h-2 w-full bg-border/40 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-primary to-accent w-[68%]" />
                    </div>
                  </div>
                </div>

                <div className="bg-surface-sunken border-border/60 flex flex-col justify-between rounded-xl border p-4">
                  <div>
                    <span className="text-subtle-foreground text-xs font-medium uppercase tracking-wider block">
                      Résultat calculé
                    </span>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="font-mono text-4xl font-extrabold text-foreground tabular-nums">−14.82</span>
                      <span className="text-muted-foreground text-sm font-semibold">dB</span>
                    </div>
                    <p className="text-subtle-foreground text-xs mt-2">
                      Marge de sécurité disponible : <span className="text-success font-mono font-medium">+3.18 dB</span>
                    </p>
                  </div>

                  <div className="mt-4 border-t border-border/40 pt-3 flex items-center justify-between text-2xs text-subtle-foreground">
                    <span>Export rapport PDF / CSV</span>
                    <span className="text-primary font-mono cursor-pointer hover:underline">Sauvegarder →</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'network' && (
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-4 lg:col-span-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-foreground text-base font-semibold">Découpage sous-réseau IPv4 / CIDR</h3>
                      <p className="text-muted-foreground text-xs">Calcul des hôtes utiles, masque, broadcast et wildcard</p>
                    </div>
                    <Badge variant="info" className="gap-1 text-2xs">
                      CIDR /26
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="bg-surface-sunken rounded-lg p-3 border border-border/50">
                      <span className="text-subtle-foreground text-2xs block">Adresse réseau</span>
                      <span className="font-mono text-xs font-semibold text-foreground">192.168.10.0</span>
                    </div>
                    <div className="bg-surface-sunken rounded-lg p-3 border border-border/50">
                      <span className="text-subtle-foreground text-2xs block">Masque sous-réseau</span>
                      <span className="font-mono text-xs font-semibold text-foreground">255.255.255.192</span>
                    </div>
                    <div className="bg-surface-sunken rounded-lg p-3 border border-border/50">
                      <span className="text-subtle-foreground text-2xs block">Adresse diffusion</span>
                      <span className="font-mono text-xs font-semibold text-foreground">192.168.10.63</span>
                    </div>
                  </div>
                </div>

                <div className="bg-surface-sunken border-border/60 flex flex-col justify-between rounded-xl border p-4">
                  <div>
                    <span className="text-subtle-foreground text-xs font-medium uppercase tracking-wider block">
                      Hôtes exploitables
                    </span>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="font-mono text-4xl font-extrabold text-foreground tabular-nums">62</span>
                      <span className="text-muted-foreground text-sm font-semibold">adresses IP</span>
                    </div>
                    <p className="text-subtle-foreground text-xs mt-2">
                      Plage : <span className="font-mono text-foreground">.1 → .62</span>
                    </p>
                  </div>

                  <div className="mt-4 border-t border-border/40 pt-3 flex items-center justify-between text-2xs text-subtle-foreground">
                    <span>Plage utile vérifiée</span>
                    <span className="text-accent font-mono">Prêt à copier</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'electrical' && (
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-4 lg:col-span-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-foreground text-base font-semibold">Puissance Triphasée & Chute de tension UTE</h3>
                      <p className="text-muted-foreground text-xs">Standard UTE C 15-105 / Câbles cuivre & alu</p>
                    </div>
                    <Badge variant="warning" className="gap-1 text-2xs">
                      Cos φ : 0.85
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="bg-surface-sunken rounded-lg p-3 border border-border/50">
                      <span className="text-subtle-foreground text-2xs block">Tension nominale</span>
                      <span className="font-mono text-sm font-semibold text-foreground">400 V AC</span>
                    </div>
                    <div className="bg-surface-sunken rounded-lg p-3 border border-border/50">
                      <span className="text-subtle-foreground text-2xs block">Courant d&apos;emploi</span>
                      <span className="font-mono text-sm font-semibold text-foreground">45.2 A</span>
                    </div>
                    <div className="bg-surface-sunken rounded-lg p-3 border border-border/50">
                      <span className="text-subtle-foreground text-2xs block">Section câble</span>
                      <span className="font-mono text-sm font-semibold text-foreground">16 mm² Cu</span>
                    </div>
                  </div>
                </div>

                <div className="bg-surface-sunken border-border/60 flex flex-col justify-between rounded-xl border p-4">
                  <div>
                    <span className="text-subtle-foreground text-xs font-medium uppercase tracking-wider block">
                      Puissance active
                    </span>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="font-mono text-4xl font-extrabold text-foreground tabular-nums">26.6</span>
                      <span className="text-muted-foreground text-sm font-semibold">kW</span>
                    </div>
                    <p className="text-subtle-foreground text-xs mt-2">
                      Chute de tension : <span className="text-success font-mono font-medium">1.84 % (&lt; 3%)</span>
                    </p>
                  </div>

                  <div className="mt-4 border-t border-border/40 pt-3 flex items-center justify-between text-2xs text-subtle-foreground">
                    <span>Dimensionnement conforme</span>
                    <Cpu className="size-4 text-warning" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
