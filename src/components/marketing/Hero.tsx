import {
  Activity,
  ArrowRight,
  Calendar,
  ChevronRight,
  Clock,
  MapPin,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wrench,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { DownloadAppModal } from '@/components/layout/DownloadAppModal';
import { ROUTES } from '@/config/routes';

export function Hero() {
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);

  return (
    <section className="pt-6 pb-8 sm:pt-10 sm:pb-12 text-slate-900 transition-colors duration-200 dark:text-white">
      <div className="mx-auto max-w-[1600px] px-3 sm:px-5 lg:px-6">
        {/* EN-TÊTE HERO : GESTION OPTIMISÉE DE L'ESPACE SUR LA GAUCHE */}
        <div className="w-full max-w-2xl lg:max-w-3xl text-left flex flex-col items-start space-y-5">
          {/* Badge Système Actif */}
          <div className="inline-flex items-center gap-2 rounded-none border border-cyan-500/30 bg-cyan-950/40 px-3.5 py-1 text-xs font-bold text-cyan-300 shadow-xs">
            <Sparkles className="size-3.5 text-cyan-400" />
            <span>Cockpit SaaS v2.4 // Orchestration Terrain &amp; IA</span>
          </div>

          {/* Titre Principal */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight text-left">
            <span className="block">Pilotez votre activité technique.</span>
            <span className="block bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-200 bg-clip-text text-transparent mt-1">
              Connectez tout votre réseau.
            </span>
          </h1>

          {/* Proposition de valeur */}
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal text-left max-w-2xl">
            La solution tout-en-un pour les entreprises techniques et équipes de terrain : interventions,
            plannings, signatures clients, suivi de matériel et outils métiers sur une plateforme unique.
          </p>

          {/* 3 CTAs EN TEXTE PUR ALIGNÉS À GAUCHE */}
          <div className="pt-2 flex items-center justify-start flex-wrap gap-4 sm:gap-6 w-full">
            {/* 1. CTA Principal */}
            <Link
              to={ROUTES.register}
              className="inline-flex shrink-0 items-center gap-2 text-sm sm:text-base font-bold text-cyan-300 hover:text-cyan-200 transition-colors cursor-pointer"
            >
              <Zap className="size-4 text-cyan-400" />
              <span>Commencer gratuitement</span>
              <ArrowRight className="size-4 text-cyan-400" />
            </Link>

            {/* 2. CTA Secondaire */}
            <Link
              to={ROUTES.tools}
              className="inline-flex shrink-0 items-center gap-1.5 text-sm sm:text-base font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <Wrench className="size-4 text-slate-400" />
              <span>Explorer les outils</span>
              <ChevronRight className="size-4 text-slate-500" />
            </Link>

            {/* 3. CTA Tertiaire : App Terrain */}
            <button
              type="button"
              onClick={() => setIsDownloadModalOpen(true)}
              className="inline-flex shrink-0 items-center gap-1.5 text-sm sm:text-base font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <Smartphone className="size-4 text-slate-400" />
              <span>App Terrain</span>
            </button>
          </div>

          {/* Bandeau de réassurance */}
          <div className="flex items-center justify-start flex-wrap gap-3 sm:gap-5 text-xs text-slate-400 font-medium pt-3 border-t border-white/10 w-full">
            <span className="flex items-center gap-1.5 shrink-0">
              <Zap className="size-3.5 text-amber-400 shrink-0" />
              <span>Outils &amp; calculs métiers</span>
            </span>
            <span className="text-white/20 shrink-0">•</span>
            <span className="flex items-center gap-1.5 shrink-0">
              <Activity className="size-3.5 text-emerald-400 shrink-0" />
              <span>Suivi direct interventions</span>
            </span>
            <span className="text-white/20 shrink-0">•</span>
            <span className="flex items-center gap-1.5 shrink-0">
              <ShieldCheck className="size-3.5 text-cyan-400 shrink-0" />
              <span>Conforme RGPD &amp; Cloud</span>
            </span>
          </div>
        </div>

        {/* Modal d'installation PWA */}
        <DownloadAppModal
          isOpen={isDownloadModalOpen}
          onClose={() => setIsDownloadModalOpen(false)}
        />

        {/* ---------------------------------------------------- SUPERVISION ÉPURÉE AVEC CADRE CARRÉ GLASSMORPHIQUE */}
        <div className="mt-12 sm:mt-16 w-full max-w-2xl lg:max-w-3xl text-left">
          <div className="border border-white/20 bg-white/[0.04] backdrop-blur-xl shadow-[0_8px_40px_0_rgba(6,182,212,0.10),0_2px_16px_0_rgba(0,0,0,0.4)] p-5 sm:p-7 space-y-6">
            {/* Ligne d'état supérieure */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3 flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-xs sm:text-sm font-bold text-white">Supervision en temps réel</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Flux d&apos;orchestration actif · v2.4</span>
              </div>
            </div>

            {/* Vue Supervision */}
            <div className="space-y-6 pt-1">
              {/* En-tête supervision */}
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-white">Bonjour, Alexandre</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Aperçu temps réel · Pilotage multi-chantiers</p>
                </div>
                <span className="font-mono text-xs text-cyan-300">
                  {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
              </div>

              {/* 4 KPIs en texte pur */}
              <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
                {[
                  { label: 'Missions', value: '24', sub: '+12% semaine', color: 'text-cyan-400' },
                  { label: 'Interventions', value: '18', sub: '56% terminées', color: 'text-emerald-400' },
                  { label: 'Techniciens', value: '14/16', sub: '87.5% actifs', color: 'text-blue-400' },
                  { label: 'Rapports', value: '5', sub: '3 urgents', color: 'text-amber-400' },
                ].map(({ label, value, sub, color }) => (
                  <div key={label} className="space-y-1">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">{label}</span>
                    <div className="font-mono text-2xl sm:text-3xl font-black text-white">{value}</div>
                    <span className={`block text-[11px] font-bold ${color}`}>{sub}</span>
                  </div>
                ))}
              </div>

              {/* Planning en liste épurée */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300 pb-2 border-b border-white/10">
                  <span className="flex items-center gap-2">
                    <Calendar className="size-4 text-cyan-400" />
                    Planning du jour
                  </span>
                  <span className="text-cyan-400 cursor-pointer hover:underline flex items-center gap-1 text-xs">
                    Voir tout <ChevronRight className="size-3.5" />
                  </span>
                </div>

                <div className="space-y-3">
                  {[
                    { id: 'INT-8902', status: 'En cours', statusColor: 'text-emerald-400', title: 'Installation & Mise en service CVC', client: 'Complexe Tertiaire Horizon', time: '08:30 - 10:30', loc: 'Paris Nord', tech: 'Jean Dupont' },
                    { id: 'INT-8903', status: 'Urgente', statusColor: 'text-rose-400', title: 'Audit Technique & Conformité Fibre', client: 'Clinique Val d\'Or', time: '10:00 - 12:00', loc: 'Lyon Centre', tech: 'Marc Antoine' },
                  ].map((row) => (
                    <div key={row.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 border-b border-white/5 gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono font-bold text-xs text-slate-400">{row.id}</span>
                          <span className={`text-[10px] font-bold ${row.statusColor}`}>● {row.status}</span>
                          <span className="font-bold text-xs sm:text-sm text-white">{row.title}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                          <span className="text-slate-300">{row.client}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1"><Clock className="size-3" /> {row.time}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1"><MapPin className="size-3" /> {row.loc}</span>
                        </div>
                      </div>
                      <div className="text-xs font-semibold text-slate-300 sm:text-right shrink-0">{row.tech}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
