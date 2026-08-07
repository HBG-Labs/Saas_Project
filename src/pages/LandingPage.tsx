import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';

import { Benefits } from '@/components/marketing/Benefits';
import { BuiltForTech } from '@/components/marketing/BuiltForTech';
import { Categories } from '@/components/marketing/Categories';
import { Faq } from '@/components/marketing/Faq';
import { Features } from '@/components/marketing/Features';
import { Hero } from '@/components/marketing/Hero';
import { Pricing } from '@/components/marketing/Pricing';
import { ProblemSection } from '@/components/marketing/ProblemSection';
import { ProfilesSection } from '@/components/marketing/ProfilesSection';
import { Testimonials } from '@/components/marketing/Testimonials';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';

export default function LandingPage() {
  return (
    <>
      <Hero />
      <ProblemSection />
      <Categories />
      <BuiltForTech />
      <Features />
      <ProfilesSection />
      <Benefits />
      <Testimonials />
      <Pricing />
      <Faq />

      {/* Appel à l'action final */}
      <section className="relative px-4 pb-24 sm:px-6">
        <div className="bg-gradient-to-r from-primary via-primary-600 to-accent text-primary-foreground border-glow shadow-modal mx-auto max-w-6xl overflow-hidden rounded-3xl px-6 py-16 text-center sm:px-12">
          <div className="mx-auto max-w-3xl">
            <span className="bg-white/10 text-white inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-md">
              <ShieldCheck className="size-3.5" />
              Sans carte bancaire • Accès gratuit immédiat
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-5xl text-white">
              Gagnez du temps sur vos calculs dès aujourd&apos;hui
            </h2>
            <p className="mt-4 text-base text-white/90 sm:text-lg">
              Rejoignez les techniciens, ingénieurs et étudiants qui centralisent leurs outils sur NexoraTech.
            </p>
            <div className="mt-8 flex justify-center">
              <Button asChild size="lg" variant="secondary" className="shadow-lg text-primary hover:bg-white font-semibold">
                <Link to={ROUTES.register}>
                  Créer un compte gratuit
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
