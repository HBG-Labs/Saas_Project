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

      {/* 9. BANNIÈRE CONVERSION FINALE AVEC ANIMATIONS DYNAMIQUES & FOND AMBIANCE INDUSTRIE */}
      <section className="py-16 sm:py-24 border-t border-border/60 bg-surface relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="group/cta relative overflow-hidden rounded-3xl border border-blue-500/20 bg-gradient-to-b from-white/95 to-slate-50/90 px-6 py-16 text-center shadow-2xl backdrop-blur-2xl transition-all duration-500 hover:border-blue-500/40 dark:border-cyan-500/20 dark:from-slate-950/95 dark:to-[#090f1d]/90 dark:shadow-blue-950/20 sm:px-12 sm:py-20">
            {/* Fond d'ambiance 3 : Inspection et ingénierie industrielle */}
            <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
              <img
                src="/images/backgrounds/industrial-inspection-ambient.jpg"
                alt="Fond d'ambiance inspection industrielle"
                aria-hidden="true"
                className="size-full object-cover object-center opacity-25 dark:opacity-35 filter saturate-110 contrast-105"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-white/85 to-slate-50/95 dark:from-slate-950/80 dark:via-slate-950/85 dark:to-[#090f1d]/95" />
            </div>

            {/* 1. Halos lumineux d'ambiance multicouches animés */}
            <div className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[380px] w-[min(550px,100vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-tr from-blue-600/20 via-indigo-500/15 to-cyan-400/20 blur-[110px] animate-glow-pulse" />
            <div className="pointer-events-none absolute -top-24 -left-24 -z-10 size-72 rounded-full bg-blue-500/15 blur-[90px] animate-float-slow" />
            <div className="pointer-events-none absolute -bottom-24 -right-24 -z-10 size-72 rounded-full bg-cyan-400/15 blur-[90px] animate-float-slow-reverse" />

            {/* 2. Grille de fond subtile */}
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.07] dark:opacity-[0.12]" />

            <div className="relative z-10 mx-auto max-w-3xl space-y-6">
              {/* Badge supérieur animé */}
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/25 bg-blue-50/80 px-3.5 py-1 text-2xs font-bold text-blue-700 backdrop-blur-md dark:border-cyan-400/30 dark:bg-cyan-950/50 dark:text-cyan-300 transition-transform duration-300 group-hover/cta:scale-105">
                <Sparkles className="size-3.5 text-blue-600 dark:text-cyan-400 animate-pulse" />
                <span>Essai gratuit 14 jours · Sans carte bancaire</span>
              </div>

              {/* Titre Principal avec Dégradé */}
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl leading-[1.18] dark:text-white text-balance">
                Prêt à décupler la{' '}
                <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 dark:from-cyan-400 dark:via-blue-400 dark:to-indigo-300 bg-clip-text text-transparent">
                  productivité
                </span>{' '}
                de votre activité technique ?
              </h2>

              <p className="text-base text-slate-600 sm:text-lg dark:text-slate-300 leading-relaxed text-balance">
                Centralisez vos interventions, vos stocks et vos calculs d’ingénierie sur une plateforme unique conçue pour le terrain.
              </p>

              {/* Bouton d'Action avec Halo Vibrant & Effet Shimmer */}
              <div className="pt-4 flex flex-col items-center justify-center gap-4">
                <div className="relative group inline-block">
                  {/* Aura lumineuse pulsante sous le bouton */}
                  <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 opacity-70 blur-lg transition duration-500 group-hover:opacity-100 group-hover:blur-xl animate-pulse" />

                  {/* Bouton interactif principal */}
                  <Link
                    to={ROUTES.register}
                    className="relative flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-blue-600 px-7 py-4 text-sm sm:text-base font-bold text-white shadow-xl shadow-blue-600/30 transition-all duration-300 hover:bg-blue-500 hover:scale-[1.03] active:scale-[0.98] cursor-pointer"
                  >
                    {/* Rayon de lumière Shimmer continu */}
                    <span className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12 animate-cta-shimmer pointer-events-none" />

                    <Zap className="size-4.5 text-cyan-200" />
                    <span className="sm:hidden">Commencer gratuitement</span>
                    <span className="hidden sm:inline">Commencer gratuitement dès maintenant</span>
                    <ArrowRight className="size-4.5 transition-transform duration-300 group-hover:translate-x-1.5" />
                  </Link>
                </div>

                {/* Points de rassurance sous le bouton */}
                <div className="flex flex-wrap items-center justify-center gap-4 text-2xs sm:text-xs text-muted-foreground pt-2">
                  <span className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                    Mise en place en 2 minutes
                  </span>
                  <span className="hidden sm:inline text-border">•</span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                    Accès Web &amp; Mobile (PWA)
                  </span>
                  <span className="hidden sm:inline text-border">•</span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                    Support technique inclus
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
