import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router';

import { BuiltForTech } from '@/components/marketing/BuiltForTech';
import { Faq } from '@/components/marketing/Faq';
import { Hero } from '@/components/marketing/Hero';
import { PlatformModulesBento } from '@/components/marketing/PlatformModulesBento';
import { Pricing } from '@/components/marketing/Pricing';
import { ScrollRevealSection } from '@/components/marketing/ScrollRevealSection';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';

const REASSURANCES = ['Accès instantané', 'Sans engagement', 'Support technique inclus'] as const;

/**
 * Page d'accueil.
 *
 * Le fond animé (`ScrollCanvasBackground`, 237 lignes de canvas peignant un
 * dégradé `#020808` plein écran) a été retiré : il imposait un noir absolu
 * derrière toute la page, incompatible avec un produit qui suit désormais le
 * thème choisi par la personne. L'ambiance vient maintenant du contenu et de
 * l'espace, pas d'un calque décoratif tournant en continu sur un téléphone de
 * chantier.
 */
export default function LandingPage() {
  return (
    <>
      <ScrollRevealSection>
        <Hero />
      </ScrollRevealSection>

      <ScrollRevealSection>
        <BuiltForTech />
      </ScrollRevealSection>

      <ScrollRevealSection>
        <PlatformModulesBento />
      </ScrollRevealSection>

      <ScrollRevealSection>
        <Pricing />
      </ScrollRevealSection>

      <ScrollRevealSection>
        <Faq />
      </ScrollRevealSection>

      {/* ---------------------------------------------------- CONVERSION FINALE */}
      <ScrollRevealSection>
        <section className="py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="border-border bg-surface shadow-raised rounded-2xl border p-8 sm:p-12">
              <div className="max-w-2xl">
                <h2 className="text-foreground text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                  Prêt à sortir vos interventions du tableur ?
                </h2>
                <p className="text-muted-foreground mt-4 text-base leading-relaxed sm:text-lg">
                  Centralisez vos interventions terrain, vos calculs normés et votre suivi de
                  matériel. Quatorze jours d’essai, sans carte bancaire.
                </p>

                <div className="mt-8">
                  <Button asChild size="lg">
                    <Link to={ROUTES.register}>
                      Démarrer mon essai gratuit
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  </Button>
                </div>

                <ul className="border-border text-muted-foreground mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-t pt-5 text-sm">
                  {REASSURANCES.map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <CheckCircle2 className="text-success size-4 shrink-0" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      </ScrollRevealSection>
    </>
  );
}
