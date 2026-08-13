import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';

import { BuiltForTech } from '@/components/marketing/BuiltForTech';
import { Categories } from '@/components/marketing/Categories';
import { Faq } from '@/components/marketing/Faq';
import { Hero } from '@/components/marketing/Hero';
import { InteractivePlayground } from '@/components/marketing/InteractivePlayground';
import { Pricing } from '@/components/marketing/Pricing';
import { Testimonials } from '@/components/marketing/Testimonials';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';

export default function LandingPage() {
  return (
    <>
      {/* 1. HERO SECTION (Titre impactant, Dual CTA & Cockpit Live) */}
      <Hero />

      {/* 2. PREUVE SOCIALE & DOMAINES D'EXPERTISES */}
      <BuiltForTech />

      {/* 3. CATALOGUE D'OUTILS PAR CATÉGORIES (Réseaux, Électricité, Télécoms, Fibre, Généraux) */}
      <Categories />

      {/* 4. DÉMONSTRATION INTERACTIVE LIVE (Calculateur NF C 15-100 & Assistant IA) */}
      <InteractivePlayground />

      {/* 5. TÉMOIGNAGES CLIENTS & CERTIFICATIONS NORMÉES */}
      <Testimonials />

      {/* 6. GRILLE TARIFAIRE SAAS TRANSPARENTE (Gratuit / Pro / Équipe) */}
      <Pricing />

      {/* 7. FOIRE AUX QUESTIONS */}
      <Faq />

      {/* BANNIÈRE CONVERSION FINALE */}
      <section className="py-16 sm:py-24 border-t border-border/60 bg-surface">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 px-6 py-16 text-center shadow-2xl backdrop-blur-xl transition-all duration-300 dark:border-transparent dark:bg-slate-950/90 dark:shadow-none sm:px-12 sm:py-20">
            {/* Halo d'ambiance */}
            <div className="absolute top-1/2 left-1/2 -z-10 h-[350px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-tr from-blue-500/15 via-indigo-500/10 to-cyan-400/15 blur-[100px]" />

            <div className="relative z-10 mx-auto max-w-3xl space-y-6">
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl leading-tight dark:text-white">
                Prêt à décupler la productivité de votre activité technique ?
              </h2>

              <p className="text-base text-slate-600 sm:text-lg dark:text-slate-300">
                Rejoignez plus de 10 000 techniciens, ingénieurs et entreprises qui automatisent leurs calculs et bilans au quotidien.
              </p>

              <div className="pt-3">
                <Button
                  asChild
                  size="lg"
                  className="rounded-xl bg-blue-600 px-8 py-3.5 font-bold text-white shadow-xl shadow-blue-600/30 hover:bg-blue-500 cursor-pointer"
                >
                  <Link to={ROUTES.register}>
                    Commencer gratuitement dès maintenant
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
