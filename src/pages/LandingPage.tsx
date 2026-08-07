import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';

import { Benefits } from '@/components/marketing/Benefits';
import { Categories } from '@/components/marketing/Categories';
import { Faq } from '@/components/marketing/Faq';
import { Features } from '@/components/marketing/Features';
import { Hero } from '@/components/marketing/Hero';
import { Pricing } from '@/components/marketing/Pricing';
import { Testimonials } from '@/components/marketing/Testimonials';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';

/**
 * Page d'accueil publique.
 *
 * Assemble uniquement des sections autonomes : chacune vit dans
 * `components/marketing/` et reste sous 200 lignes, ce qui permet de les
 * réordonner ou d'en retirer une sans toucher aux autres.
 */
export default function LandingPage() {
  return (
    <>
      <Hero />
      <Categories />
      <Features />
      <Benefits />
      <Testimonials />
      <Pricing />
      <Faq />

      {/* Appel à l'action final */}
      <section className="px-4 pb-24 sm:px-6">
        <div className="bg-primary mx-auto max-w-6xl rounded-2xl px-6 py-14 text-center sm:px-12">
          <h2 className="text-primary-foreground text-3xl font-bold tracking-tight sm:text-4xl">
            Prêt à gagner du temps sur vos calculs ?
          </h2>
          <p className="text-primary-foreground/80 mx-auto mt-4 max-w-xl text-base">
            Créez un compte gratuit et retrouvez vos outils sur tous vos appareils.
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-8">
            <Link to={ROUTES.register}>
              Commencer maintenant
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
