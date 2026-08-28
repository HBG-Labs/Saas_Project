import { ArrowRight, CheckCircle2, Sparkles, Zap } from 'lucide-react';
import { Link } from 'react-router';

import { BuiltForTech } from '@/components/marketing/BuiltForTech';
import { Categories } from '@/components/marketing/Categories';
import { Faq } from '@/components/marketing/Faq';
import { Hero } from '@/components/marketing/Hero';
import { InteractivePlayground } from '@/components/marketing/InteractivePlayground';
import { PlatformModulesBento } from '@/components/marketing/PlatformModulesBento';
import { Pricing } from '@/components/marketing/Pricing';
import { Testimonials } from '@/components/marketing/Testimonials';
import { ROUTES } from '@/config/routes';

export default function LandingPage() {
  return (
    <>
      {/* 1. HERO SECTION (Titre impactant, Dual CTA, Réseau dynamique & Fond Ambiance Terrain) */}
      <Hero />

      {/* 2. PREUVE SOCIALE & DOMAINES D'EXPERTISES */}
      <BuiltForTech />

      {/* 3. COCKPIT SAAS : GESTION DES ÉQUIPES, STOCKS, ACHATS & PARC (Avec Fond Ambiance Supervision) */}
      <PlatformModulesBento />

      {/* 4. BOÎTE À OUTILS D'INGÉNIERIE & CALCUL (13 outils universels) */}
      <Categories />

      {/* 5. DÉMONSTRATION INTERACTIVE LIVE (Simulateur Puissance & Assistant IA) */}
      <InteractivePlayground />

      {/* 6. GARANTIES TECHNIQUES & QUALITÉ DES CALCULS */}
      <Testimonials />

      {/* 7. GRILLE TARIFAIRE SAAS TRANSPARENTE (Gratuit / Pro / Équipe) */}
      <Pricing />

      {/* 8. FOIRE AUX QUESTIONS */}
      <Faq />

      {/* 9. BANNIÈRE CONVERSION FINALE : SECTION OUVERTE & PHOTO GRAND FORMAT SANS CADRE LOURD */}
      <section className="py-20 sm:py-28 border-t border-border/60 bg-surface relative overflow-hidden">
        {/* Halos d'ambiance en arrière-plan */}
        <div className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[500px] w-[min(800px,100vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-tr from-blue-600/15 via-indigo-500/10 to-cyan-400/15 blur-[130px] animate-glow-pulse" />
        <div className="pointer-events-none absolute -top-32 -left-32 -z-10 size-96 rounded-full bg-blue-500/10 blur-[110px]" />
        <div className="pointer-events-none absolute -bottom-32 -right-32 -z-10 size-96 rounded-full bg-cyan-400/10 blur-[110px]" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* GRILLE 2 COLONNES OUVERTE : TEXTE À GAUCHE (5 col) ET PHOTO GRAND FORMAT À DROITE (7 col) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            {/* COLONNE GAUCHE : TEXTE, TITRE, CTA ET RÉASSURANCE (CENTRÉ SUR MOBILE, ALIGNÉ À GAUCHE SUR DESKTOP) */}
            <div className="lg:col-span-5 text-center lg:text-left flex flex-col items-center lg:items-start space-y-6">
              {/* Badge supérieur */}
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/25 bg-blue-50/80 px-3.5 py-1 text-2xs font-bold text-blue-700 backdrop-blur-md dark:border-cyan-400/30 dark:bg-cyan-950/50 dark:text-cyan-300">
                <Sparkles className="size-3.5 text-blue-600 dark:text-cyan-400 animate-pulse" />
                <span>Essai gratuit 14 jours · Sans carte bancaire</span>
              </div>

              {/* Titre Principal */}
              <h2 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl lg:text-4xl xl:text-5xl leading-[1.15] dark:text-white text-center lg:text-left">
                Prêt à décupler la{' '}
                <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 dark:from-cyan-400 dark:via-blue-400 dark:to-indigo-300 bg-clip-text text-transparent">
                  productivité
                </span>{' '}
                de votre activité technique ?
              </h2>

              {/* Descriptif */}
              <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed font-normal text-center lg:text-left mx-auto lg:mx-0">
                Centralisez vos interventions, vos stocks et vos calculs d’ingénierie sur une plateforme unique conçue pour le terrain.
              </p>

              {/* Bouton d'Action Fin & Puces de réassurance alignées sur 1 ligne (CENTRÉ SUR MOBILE) */}
              <div className="pt-2 flex flex-col items-center lg:items-start gap-4 w-full">
                <Link
                  to={ROUTES.register}
                  className="group relative inline-flex items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 p-px font-semibold text-white shadow-[0_0_25px_rgba(37,99,235,0.35)] transition-all duration-300 hover:shadow-[0_0_35px_rgba(6,182,212,0.55)] hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  <span className="relative flex h-10.5 items-center gap-2.5 rounded-[11px] bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 px-6 text-xs sm:text-sm font-bold backdrop-blur-md transition-all duration-300">
                    <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent" />
                    <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full" />

                    <Zap className="size-3.5 text-cyan-200 transition-transform duration-300 group-hover:scale-110" />
                    <span>Commencer gratuitement dès maintenant</span>
                    <ArrowRight className="size-3.5 text-white/90 transition-transform duration-200 group-hover:translate-x-1" />
                  </span>
                </Link>

                {/* Points de réassurance alignés sur 1 ligne avec protection de défilement mobile */}
                <div className="flex items-center justify-center lg:justify-start flex-nowrap gap-2 sm:gap-3.5 text-2xs sm:text-xs text-slate-600 dark:text-slate-400 font-medium pt-2.5 border-t border-slate-200/80 dark:border-slate-800/80 w-full whitespace-nowrap overflow-x-auto no-scrollbar pb-1">
                  <span className="flex items-center gap-1.5 shrink-0">
                    <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                    <span>En 2 minutes</span>
                  </span>
                  <span className="text-slate-300 dark:text-slate-700 shrink-0">•</span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                    <span>Web &amp; Mobile PWA</span>
                  </span>
                  <span className="text-slate-300 dark:text-slate-700 shrink-0">•</span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                    <span>Support inclus</span>
                  </span>
                </div>
              </div>
            </div>

            {/* COLONNE DROITE : PHOTO GRAND FORMAT DU DÉPOT AVEC FONDU SOIGNÉ */}
            <div className="lg:col-span-7 relative w-full">
              {/* Halo d'ambiance néon étendu */}
              <div className="pointer-events-none absolute -inset-4 rounded-3xl bg-gradient-to-tr from-cyan-500/25 via-blue-600/20 to-indigo-600/25 blur-3xl opacity-70 dark:opacity-80" />

              {/* Cadre Visuel Grand Format */}
              <div className="relative group overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-cyan-500/30 bg-slate-900/5 dark:bg-slate-950/60 shadow-2xl shadow-blue-950/25 backdrop-blur-xs">
                {/* Photo Grand Format Dézoomée & Nette */}
                <img
                  src="/images/backgrounds/cta-depot-technician-neon-blue.jpg"
                  alt="Responsable technique et gestion logistique REZO360"
                  className="w-full h-auto max-h-[520px] object-cover object-center transform transition-transform duration-700 group-hover:scale-[1.02] filter contrast-105 saturate-110"
                  loading="lazy"
                />

                {/* Liseré bas subtil */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#060a12]/70 to-transparent" />

                {/* Badge Flottant Discret & Ultra-Fin en bas à gauche */}
                <div className="absolute bottom-2.5 left-2.5 z-20 flex items-center gap-1.5 rounded-full border border-cyan-500/35 bg-slate-950/75 px-2.5 py-0.5 text-[10px] sm:text-2xs font-bold text-cyan-300 backdrop-blur-md shadow-md">
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-cyan-400" />
                  </span>
                  <span>Déploiement Immédiat</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
