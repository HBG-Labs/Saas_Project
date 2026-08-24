import {
  Activity,
  ArrowRight,
  Briefcase,
  Calendar,
  ChevronRight,
  Clock,
  FileCheck2,
  MapPin,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  Wrench,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { DownloadAppModal } from '@/components/layout/DownloadAppModal';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';

import { RezoNetworkHeroCanvas } from './RezoNetworkHeroCanvas';

export function Hero() {
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);

  return (
    <section className="relative overflow-hidden pt-16 pb-24 sm:pt-24 sm:pb-32 bg-slate-50/50 text-slate-900 transition-colors duration-200 dark:bg-[#070b14] dark:text-white">
      {/* Fond d'ambiance 1 : Immersif terrain & câblage haute technologie (Cadrage vers le haut sans aucun zoom) */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <img
          src="/images/backgrounds/hero-field-ambient.jpg"
          alt="Fond d'ambiance terrain REZO360"
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover object-bottom opacity-40 dark:opacity-55 filter saturate-110 contrast-105"
        />
        {/* Masque dégradé pour préserver la lisibilité parfaite du texte tout en laissant les détails nets */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50/70 via-slate-50/30 to-slate-50 dark:from-[#070b14]/70 dark:via-[#070b14]/30 dark:to-[#070b14]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_50%_25%,transparent_15%,#f8fafc_95%)] dark:bg-[radial-gradient(ellipse_75%_55%_at_50%_25%,transparent_15%,#070b14_95%)] opacity-60" />
      </div>

      {/* 1. MOTEUR CARTOGRAPHIQUE & RÉSEAU VIVANT REZO CORE */}
      <RezoNetworkHeroCanvas />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* EN-TÊTE HERO ULTRA-MODERNE & ORCHESTRATION RÉSEAU */}
        <div className="text-center">
          {/* Badge Système Actif */}
          <div className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-blue-500/25 bg-blue-50/90 px-4 py-1.5 text-xs font-bold text-blue-700 backdrop-blur-xl transition-all hover:border-blue-400/50 hover:bg-blue-100/90 dark:border-cyan-500/30 dark:bg-cyan-950/40 dark:text-cyan-300 dark:hover:border-cyan-400/50 dark:hover:bg-cyan-900/40">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-500 opacity-75 dark:bg-cyan-400" />
              <span className="relative inline-flex size-2 rounded-full bg-blue-600 dark:bg-cyan-400" />
            </span>
            <Sparkles className="size-3.5 text-blue-600 dark:text-cyan-400" />
            <span>Cockpit SaaS v2.4 // Orchestration Terrain &amp; IA</span>
          </div>

          {/* Titre Principal Impactant */}
          <h1 className="mx-auto max-w-4xl text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-balance leading-[1.15] text-slate-900 dark:text-white">
            <span className="block">Pilotez votre activité technique.</span>
            <span className="block bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 dark:from-cyan-400 dark:via-blue-400 dark:to-indigo-400 bg-clip-text text-transparent mt-1">
              Connectez tout votre réseau.
            </span>
          </h1>

          {/* Proposition de valeur universelle pour toutes les entreprises techniques */}
          <p className="mx-auto mt-5 max-w-2xl text-balance text-base sm:text-lg leading-relaxed text-slate-600 dark:text-slate-300">
            La solution tout-en-un pour les entreprises techniques et équipes de terrain : interventions,
            plannings, signatures clients, suivi de matériel et outils métiers sur une plateforme unique.
          </p>

          {/* Dual CTAs & Installation Mobile */}
          <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3.5">
            {/* CTA Principal : Gradient Tech Lumineux */}
            <Button
              asChild
              size="lg"
              className="group h-12 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-6.5 font-bold text-white shadow-lg shadow-blue-600/25 ring-1 ring-white/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-500/35 hover:brightness-105 active:translate-y-0 cursor-pointer"
            >
              <Link to={ROUTES.register}>
                Commencer gratuitement
                <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>

            {/* CTA Secondaire : Glassmorphism & Catalogue Outils */}
            <Button
              asChild
              size="lg"
              className="group h-12 rounded-xl border border-slate-300/80 bg-white/90 px-5.5 font-semibold text-slate-800 backdrop-blur-md shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-400 hover:bg-slate-100 hover:text-slate-950 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800/90 dark:hover:text-white active:translate-y-0 cursor-pointer"
            >
              <Link to={ROUTES.tools}>
                Explorer les outils métiers
                <ArrowRight className="ml-2 size-4 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-slate-600 dark:group-hover:text-slate-200" />
              </Link>
            </Button>

            {/* CTA 3 : Accès & Installation Application Terrain */}
            <Button
              variant="outline"
              size="lg"
              onClick={() => setIsDownloadModalOpen(true)}
              className="h-12 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-5 font-semibold text-cyan-700 backdrop-blur-md shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-500/50 hover:bg-cyan-500/20 hover:text-cyan-800 dark:border-cyan-400/25 dark:bg-cyan-950/40 dark:text-cyan-300 dark:hover:border-cyan-400/45 dark:hover:bg-cyan-900/50 dark:hover:text-cyan-200 active:translate-y-0 cursor-pointer gap-2"
            >
              <Smartphone className="size-4 text-cyan-600 dark:text-cyan-400" />
              <span className="lg:hidden">Installer l&apos;app</span>
              <span className="hidden lg:inline">Installer l&apos;application terrain</span>
            </Button>
          </div>

          {/* Bandeau de réassurance / Ticker d'orchestration technique */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-600 dark:text-slate-400 font-medium">
            <span className="flex items-center gap-2">
              <Zap className="size-4 text-amber-500 dark:text-amber-400" />
              <span>Outils &amp; calculs multi-métiers</span>
            </span>
            <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
            <span className="flex items-center gap-2">
              <Activity className="size-4 text-emerald-600 dark:text-emerald-400" />
              <span>Suivi des interventions en direct</span>
            </span>
            <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-blue-600 dark:text-cyan-400" />
              <span>Conforme RGPD &amp; Cloud sécurisé</span>
            </span>
          </div>
        </div>

        {/* Modal d'installation PWA */}
        <DownloadAppModal
          isOpen={isDownloadModalOpen}
          onClose={() => setIsDownloadModalOpen(false)}
        />

        {/* ---------------------------------------------------- MOCKUP DASHBOARD SHOWCASE */}
        <div className="mt-16 sm:mt-24">
          <div className="relative mx-auto max-w-6xl rounded-3xl border border-slate-200/90 bg-white/95 p-4 shadow-2xl backdrop-blur-2xl transition-all duration-300 hover:border-blue-300 dark:border-blue-500/20 dark:bg-slate-950/85 dark:hover:border-cyan-500/40 sm:p-6 lg:p-8">
            {/* Effet néon au sommet du cadre */}
            <div className="pointer-events-none absolute -top-px left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-blue-500/50 dark:via-cyan-400/80 to-transparent" />

            {/* Header du Mockup */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800/90 pb-4">
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-full bg-rose-500/80" />
                <span className="size-3 rounded-full bg-amber-500/80" />
                <span className="size-3 rounded-full bg-emerald-500/80" />
                <span className="ml-2 font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">
                  rezo360-cockpit.saas // v2.4
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 px-3 py-1 text-xs font-bold">
                <span className="size-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                <span>Flux d’orchestration actif</span>
              </div>
            </div>

            {/* Contenu du Dashboard Mockup */}
            <div className="space-y-6">
              {/* Bienvenue */}
              <div className="flex flex-col justify-between gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-4 sm:flex-row sm:items-center">
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white sm:text-2xl">
                      Bonjour, Alexandre
                    </h2>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-2xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400">
                      <span className="size-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                      Session Sécurisée
                    </span>
                    <span className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-2xs font-bold text-slate-700 dark:bg-slate-800/90 dark:border-slate-700 dark:text-slate-300">
                      Responsable Opérations Multi-Métiers
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Aperçu temps réel de votre activité entreprise — Pilotage multi-chantiers
                  </p>
                </div>
                <span className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-1 font-mono text-xs font-bold text-blue-700 dark:bg-blue-950/70 dark:border-blue-800/50 dark:text-blue-300">
                  {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
              </div>

              {/* 4 Cartes KPIs */}
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <div className="rounded-2xl border border-blue-200/80 bg-blue-50/40 p-4 transition-all hover:scale-102 hover:border-blue-300 dark:border-blue-900/50 dark:bg-blue-950/40 dark:hover:border-blue-700/60">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
                    <span>Missions</span>
                    <div className="rounded-lg bg-blue-500/15 p-2 text-blue-600 dark:bg-blue-500/20 dark:text-cyan-400">
                      <Briefcase className="size-4" />
                    </div>
                  </div>
                  <span className="font-mono text-3xl font-black text-slate-900 dark:text-white">24</span>
                  <span className="mt-1 block text-[11px] font-bold text-emerald-600 dark:text-emerald-400">+12% cette semaine</span>
                </div>

                <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4 transition-all hover:scale-102 hover:border-emerald-300 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:hover:border-emerald-700/60">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
                    <span>Interventions</span>
                    <div className="rounded-lg bg-emerald-500/15 p-2 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                      <Wrench className="size-4" />
                    </div>
                  </div>
                  <span className="font-mono text-3xl font-black text-slate-900 dark:text-white">18</span>
                  <span className="mt-1 block text-[11px] font-bold text-emerald-600 dark:text-emerald-400">56% terminées</span>
                </div>

                <div className="rounded-2xl border border-violet-200/80 bg-violet-50/40 p-4 transition-all hover:scale-102 hover:border-violet-300 dark:border-violet-900/50 dark:bg-violet-950/40 dark:hover:border-violet-700/60">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
                    <span>Techniciens</span>
                    <div className="rounded-lg bg-violet-500/15 p-2 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400">
                      <Users className="size-4" />
                    </div>
                  </div>
                  <span className="font-mono text-3xl font-black text-slate-900 dark:text-white">14/16</span>
                  <span className="mt-1 block text-[11px] font-bold text-violet-600 dark:text-violet-400">87.5% actifs</span>
                </div>

                <div className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-4 transition-all hover:scale-102 hover:border-amber-300 dark:border-amber-900/50 dark:bg-amber-950/40 dark:hover:border-amber-700/60">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
                    <span>Rapports</span>
                    <div className="rounded-lg bg-amber-500/15 p-2 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                      <FileCheck2 className="size-4" />
                    </div>
                  </div>
                  <span className="font-mono text-3xl font-black text-slate-900 dark:text-white">5</span>
                  <span className="mt-1 block text-[11px] font-bold text-amber-600 dark:text-amber-400">3 urgents à valider</span>
                </div>
              </div>

              {/* Tableau d'Interventions du jour */}
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-800/80 dark:bg-slate-900/70">
                <div className="mb-3 flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-2 text-slate-900 dark:text-white">
                    <Calendar className="size-4 text-blue-600 dark:text-cyan-400" />
                    Planning des interventions du jour
                  </span>
                  <span className="flex items-center gap-1 text-blue-600 dark:text-cyan-400 select-none">
                    Voir tout <ChevronRight className="size-3.5" />
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-xl bg-white border border-slate-200/80 p-3.5 text-xs shadow-2xs dark:bg-slate-950/80 dark:border-slate-800/70">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-500 dark:text-slate-400">INT-8902</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/70 dark:border-emerald-500/30 dark:text-emerald-400">
                          <span className="size-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                          En cours
                        </span>
                      </div>
                      <div className="font-bold text-slate-900 dark:text-white">Installation &amp; Mise en service CVC</div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Complexe Tertiaire Horizon</span>
                        <span className="flex items-center gap-1"><Clock className="size-3" /> 08:30 - 10:30</span>
                        <span className="flex items-center gap-1"><MapPin className="size-3" /> Paris Nord</span>
                      </div>
                    </div>
                    <div className="text-right font-semibold text-slate-700 dark:text-slate-200">
                      Jean Dupont
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-xl bg-white border border-slate-200/80 p-3.5 text-xs shadow-2xs dark:bg-slate-950/80 dark:border-slate-800/70">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-500 dark:text-slate-400">INT-8903</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/70 dark:border-rose-500/30 dark:text-rose-400">
                          <span className="size-1.5 rounded-full bg-rose-500 dark:bg-rose-400 animate-ping" />
                          Urgente
                        </span>
                      </div>
                      <div className="font-bold text-slate-900 dark:text-white">Audit Technique &amp; Conformité Fibre</div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Clinique Val d&apos;Or</span>
                        <span className="flex items-center gap-1"><Clock className="size-3" /> 10:00 - 12:00</span>
                      </div>
                    </div>
                    <div className="text-right font-semibold text-slate-700 dark:text-slate-200">
                      Marc Antoine
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
