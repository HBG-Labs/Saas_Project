import { ArrowRight, CheckCircle2, Sparkles, Zap } from 'lucide-react';
import { Link } from 'react-router';

import { BuiltForTech } from '@/components/marketing/BuiltForTech';
import { Faq } from '@/components/marketing/Faq';
import { Hero } from '@/components/marketing/Hero';
import { PlatformModulesBento } from '@/components/marketing/PlatformModulesBento';
import { Pricing } from '@/components/marketing/Pricing';
import { ScrollCanvasBackground } from '@/components/marketing/ScrollCanvasBackground';
import { ScrollRevealSection } from '@/components/marketing/ScrollRevealSection';
import { ROUTES } from '@/config/routes';

export default function LandingPage() {
  return (
    <>
      {/* ANIMATION DE FOND VERROUILLÉE SUR LE DÉFILEMENT DE LA PAGE */}
      <ScrollCanvasBackground />

      <div className="relative z-10">
        {/* 1. HERO SECTION */}
        <ScrollRevealSection>
          <Hero />
        </ScrollRevealSection>

        {/* 2. SECTEURS D'ACTIVITÉ */}
        <ScrollRevealSection>
          <BuiltForTech />
        </ScrollRevealSection>

        {/* 3. COCKPIT SAAS : GESTION DES ÉQUIPES, STOCKS, ACHATS & PARC */}
        <ScrollRevealSection>
          <PlatformModulesBento />
        </ScrollRevealSection>

        {/* 4. GRILLE TARIFAIRE SAAS TRANSPARENTE (Gratuit / Pro / Équipe) */}
        <ScrollRevealSection>
          <Pricing />
        </ScrollRevealSection>

        {/* 8. FOIRE AUX QUESTIONS */}
        <ScrollRevealSection>
          <Faq />
        </ScrollRevealSection>

        {/* 9. BANNIÈRE CONVERSION FINALE : GESTION OPTIMISÉE DE L'ESPACE SUR LA DROITE */}
        <ScrollRevealSection>
          <section className="py-20 sm:py-28">
            <div className="mx-auto max-w-[1600px] px-3 sm:px-5 lg:px-6 flex justify-start lg:justify-end">
              <div className="w-full max-w-2xl lg:max-w-3xl text-left flex flex-col items-start space-y-6">
                {/* Badge supérieur */}
                <div className="inline-flex items-center gap-2 rounded-none border border-cyan-500/30 bg-cyan-950/40 px-3.5 py-1 text-xs font-bold text-cyan-300 shadow-xs">
                  <Sparkles className="size-3.5 text-cyan-400" />
                  <span>Essai gratuit 14 jours · Sans carte bancaire</span>
                </div>

                {/* Titre Principal */}
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
                  Prêt à décupler la{' '}
                  <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-200 bg-clip-text text-transparent">
                    productivité
                  </span>{' '}
                  de votre activité technique ?
                </h2>

                {/* Descriptif */}
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal max-w-2xl">
                  Centralisez vos interventions terrain, vos calculs d’ingénierie normés et votre gestion de matériel
                  sur une interface moderne, ultra-rapide et pensée pour les professionnels.
                </p>

                {/* Bouton d'Action & Puces de réassurance épurés */}
                <div className="pt-2 flex flex-col items-start gap-4 w-full">
                  <Link
                    to={ROUTES.register}
                    className="inline-flex items-center gap-2 text-sm sm:text-base font-bold text-cyan-300 hover:text-cyan-200 transition-colors cursor-pointer"
                  >
                    <Zap className="size-4 text-cyan-400" />
                    <span>Démarrer mon essai gratuit immédiatement</span>
                    <ArrowRight className="size-4 text-cyan-400" />
                  </Link>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400 pt-2 border-t border-white/10 w-full">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                      <span>Accès instantané</span>
                    </div>
                    <span className="text-white/20">•</span>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                      <span>Sans engagement</span>
                    </div>
                    <span className="text-white/20">•</span>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                      <span>Support technique inclus</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </ScrollRevealSection>
      </div>
    </>
  );
}
