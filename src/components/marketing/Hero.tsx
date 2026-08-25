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

import heroFieldImg from '@/assets/images/backgrounds/hero-field-ambient.jpg';
import { DownloadAppModal } from '@/components/layout/DownloadAppModal';
import { ROUTES } from '@/config/routes';

import { RezoNetworkHeroCanvas } from './RezoNetworkHeroCanvas';

export function Hero() {
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);

  return (
    <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28 bg-slate-50/50 text-slate-900 transition-colors duration-200 dark:bg-[#070b14] dark:text-white">
      {/* 1. MOTEUR CARTOGRAPHIQUE & RÉSEAU VIVANT REZO CORE EN ARRIÈRE-PLAN */}
      <RezoNetworkHeroCanvas />

      {/* Halos d'ambiance lumineux d'arrière-plan */}
      <div className="pointer-events-none absolute top-1/4 -left-32 -z-10 size-96 rounded-full bg-blue-500/10 dark:bg-cyan-500/15 blur-[120px]" />
      <div className="pointer-events-none absolute top-1/3 -right-32 -z-10 size-96 rounded-full bg-indigo-500/10 dark:bg-blue-600/15 blur-[120px]" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* GRILLE 2 COLONNES : TEXTE À GAUCHE (6 col), PHOTO DÉZOOMÉE & MISE EN VALEUR À DROITE (6 col) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 xl:gap-12 items-center">
          {/* COLONNE GAUCHE : TEXTE, TITRE, CTAs ET RÉASSURANCE (CENTRÉ SUR MOBILE, ALIGNÉ À GAUCHE SUR DESKTOP) */}
          <div className="lg:col-span-6 xl:col-span-6 text-center lg:text-left flex flex-col items-center lg:items-start">
            {/* Badge Système Actif */}
            <div className="inline-flex items-center gap-2.5 rounded-full border border-blue-500/25 bg-blue-50/90 dark:border-cyan-500/30 dark:bg-cyan-950/50 px-4 py-1.5 text-xs font-bold text-blue-700 dark:text-cyan-300 backdrop-blur-xl shadow-xs transition-all hover:border-blue-400/50 hover:bg-blue-100/90 dark:hover:border-cyan-400/50 dark:hover:bg-cyan-900/40">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-500 opacity-75 dark:bg-cyan-400" />
                <span className="relative inline-flex size-2 rounded-full bg-blue-600 dark:bg-cyan-400" />
              </span>
              <Sparkles className="size-3.5 text-blue-600 dark:text-cyan-400" />
              <span>Cockpit SaaS v2.4 // Orchestration Terrain &amp; IA</span>
            </div>

            {/* Titre Principal Impactant */}
            <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl lg:text-4xl xl:text-5xl leading-[1.15] text-slate-900 dark:text-white text-center lg:text-left">
              <span className="block">Pilotez votre activité technique.</span>
              <span className="block bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-600 dark:from-cyan-400 dark:via-blue-400 dark:to-indigo-300 bg-clip-text text-transparent mt-1">
                Connectez tout votre réseau.
              </span>
            </h1>

            {/* Proposition de valeur universelle */}
            <p className="mt-5 max-w-xl text-base sm:text-lg leading-relaxed text-slate-600 dark:text-slate-300 font-normal text-center lg:text-left mx-auto lg:mx-0">
              La solution tout-en-un pour les entreprises techniques et équipes de terrain : interventions,
              plannings, signatures clients, suivi de matériel et outils métiers sur une plateforme unique.
            </p>

            {/* 3 CTAs HAUT DE GAMME : CENTRÉS SUR MOBILE, ALIGNÉS À GAUCHE SUR DESKTOP */}
            <div className="mt-7 flex items-center justify-center lg:justify-start flex-nowrap gap-1.5 sm:gap-2.5 w-full whitespace-nowrap overflow-x-auto no-scrollbar pb-1">
              {/* 1. CTA Principal : Cœur Électrique Lumineux & Lame Shimmer Spéculaire */}
              <Link
                to={ROUTES.register}
                className="group relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 p-px font-semibold text-white shadow-[0_0_20px_rgba(37,99,235,0.35)] transition-all duration-300 hover:shadow-[0_0_28px_rgba(6,182,212,0.55)] hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <span className="relative flex h-9 sm:h-10 items-center gap-1 sm:gap-1.5 rounded-[11px] bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 px-2.5 sm:px-4 text-[11px] sm:text-xs font-bold backdrop-blur-md transition-all duration-300">
                  {/* Liseré supérieur de réflexion miroir */}
                  <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent" />
                  {/* Rayon de brillance traversant au survol */}
                  <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full" />

                  <Zap className="size-3 sm:size-3.5 text-cyan-200 transition-transform duration-300 group-hover:scale-110 shrink-0" />
                  <span>Commencer<span className="hidden sm:inline">&nbsp;gratuitement</span></span>
                  <ArrowRight className="size-3 sm:size-3.5 text-white/90 transition-transform duration-200 group-hover:translate-x-0.5 shrink-0" />
                </span>
              </Link>

              {/* 2. CTA Secondaire : Verre Obsidienne Fumé & Bordure Laser Cyan */}
              <Link
                to={ROUTES.tools}
                className="group relative inline-flex shrink-0 h-9 sm:h-10 items-center justify-center gap-1 sm:gap-1.5 overflow-hidden rounded-xl border border-slate-300/90 dark:border-slate-700/80 bg-white/90 dark:bg-slate-900/90 px-2 sm:px-3 text-[11px] sm:text-xs font-semibold text-slate-800 dark:text-slate-200 backdrop-blur-xl shadow-md transition-all duration-300 hover:border-cyan-500/60 hover:bg-slate-50 dark:hover:bg-slate-800/90 hover:text-slate-950 dark:hover:text-white hover:shadow-[0_0_18px_rgba(6,182,212,0.25)] hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                {/* Liseré supérieur métallique */}
                <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
                <Wrench className="size-3 text-slate-400 transition-colors duration-300 group-hover:text-cyan-500 dark:group-hover:text-cyan-400 shrink-0" />
                <span>Explorer<span className="hidden sm:inline">&nbsp;les outils</span></span>
                <ChevronRight className="size-3 text-slate-400 dark:text-slate-500 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-cyan-400 shrink-0" />
              </Link>

              {/* 3. CTA Tertiaire : App Terrain (Même style verre obsidienne qu'Explorer les outils) */}
              <button
                type="button"
                onClick={() => setIsDownloadModalOpen(true)}
                className="group relative inline-flex shrink-0 h-9 sm:h-10 items-center justify-center gap-1 sm:gap-1.5 overflow-hidden rounded-xl border border-slate-300/90 dark:border-slate-700/80 bg-white/90 dark:bg-slate-900/90 px-2 sm:px-3 text-[11px] sm:text-xs font-semibold text-slate-800 dark:text-slate-200 backdrop-blur-xl shadow-md transition-all duration-300 hover:border-cyan-500/60 hover:bg-slate-50 dark:hover:bg-slate-800/90 hover:text-slate-950 dark:hover:text-white hover:shadow-[0_0_18px_rgba(6,182,212,0.25)] hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                {/* Liseré supérieur métallique */}
                <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
                <span className="relative flex size-1.5 shrink-0">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-cyan-400 opacity-80" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-cyan-400" />
                </span>
                <Smartphone className="size-3 text-slate-400 transition-colors duration-300 group-hover:text-cyan-500 dark:group-hover:text-cyan-400 shrink-0" />
                <span>App<span className="hidden sm:inline">&nbsp;Terrain</span></span>
              </button>
            </div>

            {/* Bandeau de réassurance / Ticker d'orchestration technique (CENTRÉ SUR MOBILE, ALIGNÉ À GAUCHE SUR DESKTOP) */}
            <div className="mt-7 flex items-center justify-center lg:justify-start flex-nowrap gap-1.5 sm:gap-3 text-[10px] sm:text-xs text-slate-600 dark:text-slate-400 font-medium pt-3.5 border-t border-slate-200/80 dark:border-slate-800/80 w-full whitespace-nowrap overflow-x-auto no-scrollbar pb-1">
              <span className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                <Zap className="size-3 sm:size-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
                <span>Outils<span className="hidden sm:inline">&nbsp;&amp; calculs</span> métiers</span>
              </span>
              <span className="text-slate-300 dark:text-slate-700 shrink-0">•</span>
              <span className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                <Activity className="size-3 sm:size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Suivi<span className="hidden sm:inline">&nbsp;direct</span> interventions</span>
              </span>
              <span className="text-slate-300 dark:text-slate-700 shrink-0">•</span>
              <span className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                <ShieldCheck className="size-3 sm:size-3.5 text-blue-600 dark:text-cyan-400 shrink-0" />
                <span><span className="hidden sm:inline">Conforme&nbsp;</span>RGPD &amp; Cloud</span>
              </span>
            </div>
          </div>

          {/* COLONNE DROITE : PHOTO MISE EN VALEUR (6 COLONNES) */}
          <div className="lg:col-span-6 xl:col-span-6 relative">
            {/* Halo lumineux d'accentuation en arrière-plan */}
            <div className="pointer-events-none absolute -inset-3 rounded-3xl bg-gradient-to-tr from-blue-600/30 via-cyan-500/25 to-indigo-600/30 blur-2xl opacity-70 dark:opacity-80" />

            {/* Cadre Visuel Haut de Gamme avec Fondu Dégradé */}
            <div className="relative group overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-cyan-500/30 bg-slate-900/5 dark:bg-slate-950/60 shadow-2xl shadow-blue-950/20 backdrop-blur-xs">
              {/* Photo Nette et Lumineuse sans filtre assombrissant */}
              <img
                src={heroFieldImg}
                alt="Techniciens terrain connectés sur REZO360"
                className="w-full h-auto max-h-[500px] lg:max-h-[520px] object-cover object-center transform transition-transform duration-700 group-hover:scale-[1.02] filter contrast-105 saturate-110"
                loading="eager"
              />

              {/* Fondus dégradés subtils & stylés pour une intégration fluide sans coupure */}
              {/* Fondu latéral gauche (vers le texte) */}
              <div className="pointer-events-none absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-slate-50/90 via-slate-50/30 to-transparent dark:from-[#070b14]/90 dark:via-[#070b14]/30 dark:to-transparent" />
              {/* Fondu bas */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-50/80 via-slate-50/20 to-transparent dark:from-[#070b14]/85 dark:via-[#070b14]/20 dark:to-transparent" />
              {/* Fondu latéral droit léger */}
              <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-slate-50/50 via-transparent to-transparent dark:from-[#070b14]/60 dark:via-transparent dark:to-transparent" />

              {/* Badges Flottants Discrets & Ultra-Fins */}
              {/* 1. Statut Actif en haut à droite */}
              <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1.5 rounded-full border border-emerald-500/35 bg-slate-950/75 px-2.5 py-0.5 text-[10px] sm:text-2xs font-bold text-emerald-400 backdrop-blur-md shadow-md">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
                </span>
                <span>Flux Terrain Actif</span>
              </div>

              {/* 2. Badge Équipe en bas à gauche */}
              <div className="absolute bottom-2.5 left-2.5 z-20 flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-950/75 px-2.5 py-1 text-[10px] sm:text-2xs font-medium text-slate-200 backdrop-blur-md shadow-md">
                <Users className="size-3 text-cyan-400" />
                <span>14/16 techniciens</span>
              </div>
            </div>
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
