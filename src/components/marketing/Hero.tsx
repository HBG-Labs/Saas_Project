import {
  Activity,
  ArrowRight,
  Briefcase,
  Calendar,
  ChevronRight,
  Clock,
  FileCheck2,
  LayoutDashboard,
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
import { ROUTES } from '@/config/routes';

import { RezoNetworkHeroCanvas } from './RezoNetworkHeroCanvas';

type CockpitTab = 'supervision' | 'calculators' | 'reports';

export function Hero() {
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<CockpitTab>('supervision');

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
            <div className="mt-7 flex items-center justify-center lg:justify-start flex-wrap gap-2 sm:gap-2.5 w-full">
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
                src="/images/backgrounds/hero-field-ambient.jpg"
                alt="Techniciens terrain connectés sur REZO360"
                className="w-full h-auto max-h-[500px] lg:max-h-[520px] object-cover object-center transform transition-transform duration-700 group-hover:scale-[1.02] filter contrast-105 saturate-110"
                loading="eager"
              />

              {/* Liseré subtil en bas uniquement pour ancrer l'image */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#070b14]/70 to-transparent" />

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

        {/* ---------------------------------------------------- COCKPIT INTERACTIF */}
        <div className="mt-16 sm:mt-24">
          <div className="relative mx-auto max-w-6xl rounded-3xl border border-slate-200/90 bg-white/95 p-4 shadow-2xl backdrop-blur-2xl transition-all duration-300 hover:border-blue-300 dark:border-blue-500/20 dark:bg-slate-950/90 dark:hover:border-cyan-500/40 sm:p-6 lg:p-8">
            {/* Ligne néon sommet */}
            <div className="pointer-events-none absolute -top-px left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-blue-500/50 dark:via-cyan-400/80 to-transparent" />

            {/* Header barre de titre macOS */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800/90 pb-4">
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-full bg-rose-500/80" />
                <span className="size-3 rounded-full bg-amber-500/80" />
                <span className="size-3 rounded-full bg-emerald-500/80" />
                <span className="ml-2 font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">rezo360-cockpit.saas // v2.4</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 px-3 py-1 text-xs font-bold">
                <span className="size-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                <span>Flux d&apos;orchestration actif</span>
              </div>
            </div>

            {/* Onglets interactifs */}
            <div className="mb-6 flex gap-1 rounded-xl bg-slate-100/80 p-1 dark:bg-slate-900/80">
              {([
                { key: 'supervision', label: 'Supervision', icon: LayoutDashboard },
                { key: 'calculators', label: 'Calculateurs', icon: Wrench },
                { key: 'reports', label: 'Rapports', icon: FileCheck2 },
              ] as const).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-200 ${
                    activeTab === key
                      ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-800 dark:text-cyan-300'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300'
                  }`}
                >
                  <Icon className="size-3.5 shrink-0" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>

            {/* ——— VUE 1 : SUPERVISION ——— */}
            {activeTab === 'supervision' && (
              <div className="space-y-5">
                {/* Bandeau Bienvenue */}
                <div className="flex flex-col justify-between gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-4 sm:flex-row sm:items-center">
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="text-xl font-extrabold text-slate-900 dark:text-white sm:text-2xl">Bonjour, Alexandre</h2>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-2xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400">
                        <span className="size-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                        Session Sécurisée
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Aperçu temps réel · Pilotage multi-chantiers</p>
                  </div>
                  <span className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-1 font-mono text-xs font-bold text-blue-700 dark:bg-blue-950/70 dark:border-blue-800/50 dark:text-blue-300">
                    {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </span>
                </div>

                {/* 4 KPIs */}
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {[
                    { label: 'Missions', value: '24', sub: '+12% semaine', color: 'blue', Icon: Briefcase },
                    { label: 'Interventions', value: '18', sub: '56% terminées', color: 'emerald', Icon: Wrench },
                    { label: 'Techniciens', value: '14/16', sub: '87.5% actifs', color: 'violet', Icon: Users },
                    { label: 'Rapports', value: '5', sub: '3 urgents', color: 'amber', Icon: FileCheck2 },
                  ].map(({ label, value, sub, color, Icon }) => (
                    <div key={label} className={`rounded-2xl border border-${color}-200/80 bg-${color}-50/40 p-4 transition-all hover:scale-[1.02] dark:border-${color}-900/50 dark:bg-${color}-950/40`}>
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
                        <span>{label}</span>
                        <div className={`rounded-lg bg-${color}-500/15 p-2 text-${color}-600 dark:bg-${color}-500/20 dark:text-${color}-400`}>
                          <Icon className="size-4" />
                        </div>
                      </div>
                      <span className="font-mono text-3xl font-black text-slate-900 dark:text-white">{value}</span>
                      <span className={`mt-1 block text-[11px] font-bold text-${color}-600 dark:text-${color}-400`}>{sub}</span>
                    </div>
                  ))}
                </div>

                {/* Tableau planning */}
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-800/80 dark:bg-slate-900/70">
                  <div className="mb-3 flex items-center justify-between text-xs font-bold">
                    <span className="flex items-center gap-2 text-slate-900 dark:text-white">
                      <Calendar className="size-4 text-blue-600 dark:text-cyan-400" />
                      Planning du jour
                    </span>
                    <span className="flex items-center gap-1 text-blue-600 dark:text-cyan-400">Voir tout <ChevronRight className="size-3.5" /></span>
                  </div>
                  <div className="space-y-2">
                    {[
                      { id: 'INT-8902', status: 'En cours', statusColor: 'emerald', title: 'Installation & Mise en service CVC', client: 'Complexe Tertiaire Horizon', time: '08:30 - 10:30', loc: 'Paris Nord', tech: 'Jean Dupont', ping: false },
                      { id: 'INT-8903', status: 'Urgente', statusColor: 'rose', title: 'Audit Technique & Conformité Fibre', client: 'Clinique Val d\'Or', time: '10:00 - 12:00', loc: 'Lyon Centre', tech: 'Marc Antoine', ping: true },
                    ].map((row) => (
                      <div key={row.id} className="flex flex-col gap-2 rounded-xl bg-white border border-slate-200/80 p-3.5 text-xs shadow-2xs sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950/80 dark:border-slate-800/70">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-500 dark:text-slate-400">{row.id}</span>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold bg-${row.statusColor}-50 border border-${row.statusColor}-200 text-${row.statusColor}-700 dark:bg-${row.statusColor}-950/70 dark:border-${row.statusColor}-500/30 dark:text-${row.statusColor}-400`}>
                              <span className={`size-1.5 rounded-full bg-${row.statusColor}-500 dark:bg-${row.statusColor}-400 ${row.ping ? 'animate-ping' : 'animate-pulse'}`} />
                              {row.status}
                            </span>
                          </div>
                          <div className="font-bold text-slate-900 dark:text-white">{row.title}</div>
                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{row.client}</span>
                            <span className="flex items-center gap-1"><Clock className="size-3" /> {row.time}</span>
                            <span className="flex items-center gap-1"><MapPin className="size-3" /> {row.loc}</span>
                          </div>
                        </div>
                        <div className="font-semibold text-slate-700 dark:text-slate-200 sm:text-right shrink-0">{row.tech}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ——— VUE 2 : CALCULATEURS ——— */}
            {activeTab === 'calculators' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">Calculateurs d&apos;ingénierie certifiés</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">36 outils · Normes NF C 15-100, ITU-T G.652, Eurocodes</p>
                  </div>
                  <span className="rounded-md bg-cyan-950/80 border border-cyan-800/50 px-3 py-1 font-mono text-xs font-bold text-cyan-300">UTE &amp; ISO/IEC</span>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {[
                    { title: 'Bilan Optique FTTH', color: 'cyan', value: '14.85 dB', desc: 'Liaison 12 km @ 1310 nm · 4 épissures · coupleur 1:8', result: 'Marge : +15.15 dB (Classe B+)' },
                    { title: 'Puissance Triphasée', color: 'amber', value: '25.5 A / ph', desc: '15 kW sous 400 V · cos φ = 0.85', result: 'Disjoncteur : 32 A Courbe C' },
                    { title: 'Sous-réseau IP', color: 'indigo', value: '/27 · 30 hôtes', desc: 'Plage : 192.168.10.1 → 192.168.10.30', result: 'Masque : 255.255.255.224' },
                  ].map(({ title, color, value, desc, result }) => (
                    <div key={title} className={`rounded-2xl border border-${color}-500/30 bg-slate-900/80 p-5 space-y-3`}>
                      <div className="flex items-center justify-between">
                        <span className={`font-bold text-${color}-300 text-sm`}>{title}</span>
                        <span className={`font-mono text-xs text-${color}-400 font-bold`}>{value}</span>
                      </div>
                      <p className="text-xs text-slate-400">{desc}</p>
                      <div className="rounded-lg bg-slate-950 p-2.5 font-mono text-[11px] text-slate-300 border border-slate-800">{result}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ——— VUE 3 : RAPPORTS ——— */}
            {activeTab === 'reports' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">Rapports &amp; Signatures numériques</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">PDF certifié + signature client sur smartphone dès la fin des travaux</p>
                  </div>
                  <span className="rounded-md bg-emerald-950/80 border border-emerald-800/50 px-3 py-1 font-mono text-xs font-bold text-emerald-300">Horodatage</span>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <FileCheck2 className="size-5 text-emerald-400" />
                      <div>
                        <div className="font-bold text-white text-sm">Rapport #RAP-2026-089</div>
                        <div className="text-xs text-slate-400">Client : Groupe Hospitalier Paris Est</div>
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-400">✓ Signé</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
                    {[
                      { label: 'Durée intervention', value: '2h 15m (conforme devis)' },
                      { label: 'Matériel utilisé', value: '2x Disjoncteurs · 45m Câble' },
                      { label: 'Export', value: 'PDF certifié + photos' },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-xl bg-slate-950 p-3 border border-slate-800">
                        <span className="block text-[10px] uppercase text-slate-500 mb-0.5">{label}</span>
                        <span className="font-bold text-white">{value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Activity className="size-3.5 text-cyan-400" />
                    <span className="text-xs text-slate-400">2 rapports en attente de signature client · <span className="text-cyan-400 font-semibold">Relance auto dans 2h</span></span>
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
