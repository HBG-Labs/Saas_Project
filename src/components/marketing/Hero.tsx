import { ArrowRight, Briefcase, Calendar, CheckCircle2, ChevronRight, Clock, FileCheck2, MapPin, Smartphone, Sparkles, Users, Wrench } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { DownloadAppModal } from '@/components/layout/DownloadAppModal';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';

export function Hero() {
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);

  return (
    <section className="relative overflow-hidden pt-16 pb-24 sm:pt-24 sm:pb-32">
      {/* Halo de lumière diffuse en arrière-plan */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[600px] w-[1000px] -translate-x-1/2 rounded-full bg-gradient-to-b from-blue-500/15 via-indigo-500/10 to-transparent blur-3xl"
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* EN-TÊTE HERO ULTRA-MODERNE */}
        <div className="text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-xs font-bold text-blue-600 backdrop-blur-md transition-all hover:border-blue-500/50 dark:border-blue-400/30 dark:bg-blue-950/60 dark:text-blue-400">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-blue-500" />
            </span>
            <Sparkles className="size-3.5 text-blue-500" />
            <span>Nouveauté : Cockpit SaaS v2.4 pour entreprises techniques</span>
          </div>

          <h1 className="mx-auto max-w-5xl text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl lg:text-7xl dark:text-white">
            Pilotez votre activité technique.{' '}
            <span className="bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-600 bg-clip-text text-transparent">
              Plus simplement.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-slate-600 sm:text-xl dark:text-slate-300">
            NexoraTech réunit vos missions, interventions, équipes, clients et outils techniques dans un espace professionnel unique.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="group rounded-2xl bg-blue-600 px-8 py-3.5 font-bold text-white shadow-lg shadow-blue-500/25 transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-500 hover:shadow-xl hover:shadow-blue-500/35"
            >
              <Link to={ROUTES.register}>
                Commencer gratuitement
                <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => setIsDownloadModalOpen(true)}
              className="rounded-2xl border-blue-500/30 bg-blue-500/10 px-8 py-3.5 font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-all cursor-pointer gap-2"
            >
              <Smartphone className="size-4" />
              Télécharger l'App Mobile (Android & iOS)
            </Button>
            <Button
              asChild
              variant="ghost"
              size="lg"
              className="rounded-2xl px-6 py-3.5 font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Link to={ROUTES.tools}>Découvrir la plateforme</Link>
            </Button>
          </div>
        </div>

        {/* Modale de Téléchargement de l'App */}
        <DownloadAppModal
          isOpen={isDownloadModalOpen}
          onClose={() => setIsDownloadModalOpen(false)}
        />

        {/* ---------------------------------------------------- MOCKUP DASHBOARD 3D SHOWCASE */}
        <div className="mt-16 sm:mt-24">
          <div className="relative mx-auto max-w-6xl rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:shadow-blue-500/10 dark:border-slate-800/80 dark:bg-slate-950/90 sm:p-6 lg:p-8">
            {/* Header du Mockup */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800/80">
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-full bg-rose-500/80" />
                <span className="size-3 rounded-full bg-amber-500/80" />
                <span className="size-3 rounded-full bg-emerald-500/80" />
                <span className="ml-2 font-mono text-xs font-semibold text-slate-400">
                  nexoratech-cockpit.saas // v2.4
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Cockpit actif en direct</span>
              </div>
            </div>

            {/* Contenu du Dashboard Mockup */}
            <div className="space-y-6">
              {/* Bienvenue */}
              <div className="flex flex-col justify-between gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-xl font-extrabold text-slate-900 sm:text-2xl dark:text-white">
                      Bonjour, Alexandre
                    </h2>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-2xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Session Sécurisée
                    </span>
                    <span className="rounded-md bg-slate-100 border border-slate-200/80 px-2 py-0.5 text-2xs font-bold text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
                      Chef de Projet Télécom
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 dark:text-slate-400">
                    Aperçu temps réel de votre activité entreprise — Thales & BNP
                  </p>
                </div>
                <span className="rounded-lg bg-blue-50 px-3 py-1 font-mono text-xs font-bold text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                  Lundi 9 août 2026
                </span>
              </div>

              {/* 4 Cartes KPIs Neon */}
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <div className="rounded-2xl border border-blue-200/60 bg-blue-50/60 p-4 transition-all hover:scale-102 dark:border-blue-900/40 dark:bg-blue-950/40">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span>Missions</span>
                    <div className="rounded-lg bg-blue-500/20 p-2 text-blue-600 dark:text-blue-400">
                      <Briefcase className="size-4" />
                    </div>
                  </div>
                  <span className="font-mono text-3xl font-black text-slate-900 dark:text-white">24</span>
                  <span className="mt-1 block text-[11px] font-bold text-emerald-600 dark:text-emerald-400">+12% cette semaine</span>
                </div>

                <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/60 p-4 transition-all hover:scale-102 dark:border-emerald-900/40 dark:bg-emerald-950/40">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span>Interventions</span>
                    <div className="rounded-lg bg-emerald-500/20 p-2 text-emerald-600 dark:text-emerald-400">
                      <Wrench className="size-4" />
                    </div>
                  </div>
                  <span className="font-mono text-3xl font-black text-slate-900 dark:text-white">18</span>
                  <span className="mt-1 block text-[11px] font-bold text-emerald-600 dark:text-emerald-400">56% terminées</span>
                </div>

                <div className="rounded-2xl border border-violet-200/60 bg-violet-50/60 p-4 transition-all hover:scale-102 dark:border-violet-900/40 dark:bg-violet-950/40">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span>Techniciens</span>
                    <div className="rounded-lg bg-violet-500/20 p-2 text-violet-600 dark:text-violet-400">
                      <Users className="size-4" />
                    </div>
                  </div>
                  <span className="font-mono text-3xl font-black text-slate-900 dark:text-white">14/16</span>
                  <span className="mt-1 block text-[11px] font-bold text-violet-600 dark:text-violet-400">87.5% actifs</span>
                </div>

                <div className="rounded-2xl border border-amber-200/60 bg-amber-50/60 p-4 transition-all hover:scale-102 dark:border-amber-900/40 dark:bg-amber-950/40">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span>Rapports</span>
                    <div className="rounded-lg bg-amber-500/20 p-2 text-amber-600 dark:text-amber-400">
                      <FileCheck2 className="size-4" />
                    </div>
                  </div>
                  <span className="font-mono text-3xl font-black text-slate-900 dark:text-white">5</span>
                  <span className="mt-1 block text-[11px] font-bold text-amber-600 dark:text-amber-400">3 urgents à valider</span>
                </div>
              </div>

              {/* Tableau d'Interventions du jour */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800/80 dark:bg-slate-900/80">
                <div className="mb-3 flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-2 text-slate-900 dark:text-white">
                    <Calendar className="size-4 text-blue-600 dark:text-blue-400" />
                    Planning des interventions du jour
                  </span>
                  <span className="flex items-center gap-1 text-blue-600 hover:underline cursor-pointer dark:text-blue-400">
                    Voir tout <ChevronRight className="size-3.5" />
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-xl bg-white p-3.5 text-xs shadow-2xs dark:bg-slate-950">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-400">INT-8902</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          En cours
                        </span>
                      </div>
                      <div className="font-bold text-slate-900 dark:text-white">Maintenance Fibre Optique</div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Thales DataCenter</span>
                        <span className="flex items-center gap-1"><Clock className="size-3" /> 08:30 - 10:30</span>
                        <span className="flex items-center gap-1"><MapPin className="size-3" /> Paris Nord</span>
                      </div>
                    </div>
                    <div className="text-right font-semibold text-slate-900 dark:text-slate-200">
                      Jean Dupont
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-xl bg-white p-3.5 text-xs shadow-2xs dark:bg-slate-950">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-400">INT-8903</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
                          <span className="size-1.5 rounded-full bg-rose-500 animate-ping" />
                          Urgente
                        </span>
                      </div>
                      <div className="font-bold text-slate-900 dark:text-white">Audit Réseau IT & Sécurité</div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Clinique Val d&apos;Or</span>
                        <span className="flex items-center gap-1"><Clock className="size-3" /> 10:00 - 12:00</span>
                      </div>
                    </div>
                    <div className="text-right font-semibold text-slate-900 dark:text-slate-200">
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
