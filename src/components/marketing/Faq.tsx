import { ChevronDown, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

const FAQS: FaqItem[] = [
  {
    id: '1',
    question: "Qu'est-ce que REZO360 exactement ?",
    answer:
      "REZO360 est la plateforme SaaS tout-en-un centralisant calculateurs normés, outils d’ingénierie certifiés et gestion technique de terrain pour les techniciens, ingénieurs et entreprises.",
  },
  {
    id: '2',
    question: 'Les calculateurs sont-ils conformes et vérifiables ?',
    answer:
      'Oui. Tous nos calculs s’appuient sur les formules mathématiques et normes officielles (NF C 15-100, ITU-T, ISO). Les formules exactes sont affichées en direct dans chaque outil.',
  },
  {
    id: '3',
    question: 'Est-ce compatible avec mon smartphone iOS ou Android ?',
    answer:
      'Oui, REZO360 est 100% responsive et optimisé pour mobile sous forme de PWA installable en 1 clic sur votre écran d’accueil pour vos interventions sur le terrain.',
  },
  {
    id: '4',
    question: 'Puis-je tester REZO360 gratuitement ?',
    answer:
      // « sans carte bancaire » n'est plus vrai : l'essai passe désormais par
      // Stripe avec saisie d'un moyen de paiement (0 € débité), sans quoi il
      // suffisait de changer d'adresse e-mail pour renouveler les 14 jours
      // indéfiniment. Promettre le contraire sur la page d'accueil se paierait
      // à l'écran suivant.
      'Oui. Les formules payantes ouvrent 14 jours d’essai : une carte est demandée pour vérification, rien n’est débité avant la fin de l’essai et vous pouvez résilier à tout moment. La formule Gratuite, elle, reste sans carte et sans limite de durée.',
  },
  {
    id: '5',
    question: 'Comment mes données d’entreprise sont-elles protégées ?',
    answer:
      // Deux corrections de fait.
      //
      // « en Europe » : la base tourne en `ca-central-1`, à Montréal. Le Canada
      // relève d'une décision d'adéquation de la Commission européenne, donc le
      // transfert est licite — mais l'hébergement n'est pas européen.
      //
      // « chiffrées de bout en bout » : l'expression a un sens précis — seuls
      // les extrémités peuvent déchiffrer, l'hébergeur en est incapable. Ce
      // n'est pas ce que fait Supabase, qui chiffre en transit et au repos tout
      // en pouvant lire la donnée. Revendiquer le bout-en-bout est l'allégation
      // de sécurité la plus facilement démentie qui soit.
      'Vos données sont hébergées au Canada, pays reconnu par la Commission européenne comme offrant un niveau de protection adéquat. Elles sont chiffrées en transit (TLS) et au repos (AES-256), et l’accès est strictement cloisonné par organisation au niveau de la base (PostgreSQL Row Level Security).',
  },
];

export function Faq() {
  const [openId, setOpenId] = useState<string | null>('1');

  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <Badge variant="primary" className="mb-4">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Questions fréquentes
          </Badge>
          <h2 className="text-foreground text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Tout ce que vous devez savoir sur REZO360
          </h2>
          <p className="text-muted-foreground mt-4 text-base leading-relaxed">
            Des réponses claires sur nos outils, la conformité des calculateurs et la sécurité de
            vos données.
          </p>
        </div>

        {/*
          Une question ouverte est un `<button aria-expanded>` associé à son
          panneau : la version précédente n'annonçait ni l'état ni le lien entre
          les deux, et le contenu replié était retiré du DOM sans que rien ne le
          signale à un lecteur d'écran.
        */}
        <div className="space-y-3">
          {FAQS.map((faq) => {
            const isOpen = openId === faq.id;
            const panelId = `faq-panel-${faq.id}`;

            return (
              <div
                key={faq.id}
                className={cn(
                  'bg-surface overflow-hidden rounded-xl border transition-colors',
                  isOpen ? 'border-primary/40' : 'border-border hover:border-border-strong',
                )}
              >
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : faq.id)}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  className="text-foreground hover:text-primary flex w-full cursor-pointer items-center justify-between gap-3 p-4 text-left text-base font-semibold transition-colors sm:p-5"
                >
                  <span className="leading-snug">{faq.question}</span>
                  <ChevronDown
                    className={cn(
                      'text-muted-foreground size-4 shrink-0 transition-transform duration-200',
                      isOpen && 'text-primary rotate-180',
                    )}
                    aria-hidden="true"
                  />
                </button>

                {isOpen ? (
                  <div
                    id={panelId}
                    className="border-border text-muted-foreground border-t p-4 text-sm leading-relaxed sm:p-5"
                  >
                    {faq.answer}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

