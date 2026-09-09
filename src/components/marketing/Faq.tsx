import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/cn';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

/**
 * Les questions telles que les pose un artisan, pas telles qu'un ingénieur les
 * formulerait.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ELLES SUIVENT LE POSITIONNEMENT, QUI A CHANGÉ
 *
 * La série précédente parlait de « calculateurs normés » et d'« outils
 * d'ingénierie certifiés » — le REZO360 des débuts, celui de la fibre et des
 * réseaux. La page d'accueil s'adresse désormais à tous les métiers de terrain.
 * Une FAQ qui répond à côté du visiteur qu'on vient d'attirer ne rassure
 * personne : elle lui confirme qu'il n'est pas au bon endroit.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * L'ESSAI EST DÉCRIT EXACTEMENT, MÊME SI C'EST MOINS VENDEUR
 *
 * « 14 jours d'essai gratuit, sans engagement » est vrai mais incomplet, et
 * l'omission se paie à l'écran suivant : l'essai des formules payantes réclame
 * une carte. Le découvrir après avoir lu qu'il n'y en avait pas besoin est
 * précisément ce qui fait fermer un onglet.
 *
 * La carte n'est pas là par gourmandise. Sans elle, il suffisait de changer
 * d'adresse e-mail pour renouveler les quatorze jours indéfiniment.
 *
 * Et la vraie bonne nouvelle est ailleurs, il serait dommage de la taire : la
 * formule Gratuite n'a ni carte ni date de fin.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const FAQS: FaqItem[] = [
  {
    id: '1',
    question: 'Qu’est-ce que REZO360 peut réellement simplifier dans mon entreprise ?',
    answer:
      'REZO360 centralise votre activité au même endroit : clients, équipes, interventions, rapports, documents, outils métier et facturation. Moins d’outils dispersés, moins de tâches administratives, et plus de temps pour votre activité.',
  },
  {
    id: '2',
    question: 'REZO360 est-il adapté à mon métier et à la taille de mon entreprise ?',
    answer:
      'Oui. REZO360 est conçu pour les indépendants, les TPE et les entreprises avec des équipes terrain, dans de nombreux métiers : BTP, électricité, plomberie, climatisation, réseaux, télécoms, espaces verts et bien d’autres.',
  },
  {
    id: '3',
    question: 'Puis-je gérer mon activité directement depuis mon téléphone ?',
    answer:
      // « Installable » est vérifiable et concret là où « responsive » ne dit
      // rien à un artisan : l'application se pose sur l'écran d'accueil comme
      // n'importe quelle autre, sans passer par un magasin d'applications.
      'Oui. REZO360 s’utilise sur ordinateur, tablette et smartphone, et s’installe sur votre écran d’accueil en un geste — sans magasin d’applications. Au bureau comme sur le terrain, vos équipes retrouvent les mêmes informations et suivent leurs interventions.',
  },
  {
    id: '4',
    question: 'Est-ce compliqué de commencer avec REZO360 ?',
    answer:
      'Non. Créez votre espace, ajoutez vos collaborateurs et vos clients, puis organisez votre première intervention. Rien à installer, rien à migrer le premier jour : vous commencez par une intervention, et vous voyez.',
  },
  {
    id: '5',
    question: 'Puis-je essayer REZO360 gratuitement avant de m’engager ?',
    answer:
      'Oui, de deux façons. La formule Gratuite est sans carte bancaire et sans limite de durée. Les formules payantes ouvrent 14 jours d’essai : une carte est demandée pour vérification, rien n’est débité avant la fin de l’essai, et vous résiliez en deux clics depuis votre espace.',
  },
  {
    id: '6',
    question: 'Comment mes données d’entreprise sont-elles protégées ?',
    answer:
      // Deux formulations à ne pas laisser revenir.
      //
      // « en Europe » : la base tourne en `ca-central-1`, à Montréal. Le Canada
      // relève d'une décision d'adéquation de la Commission européenne, donc le
      // transfert est licite — mais l'hébergement n'est pas européen.
      //
      // « chiffrées de bout en bout » : l'expression a un sens précis — seuls
      // les extrémités peuvent déchiffrer, l'hébergeur en est incapable. Ce
      // n'est pas ce que fait Supabase, qui chiffre en transit et au repos tout
      // en pouvant lire la donnée. C'est l'allégation de sécurité la plus
      // facilement démentie qui soit.
      'Vos données sont hébergées au Canada, pays reconnu par la Commission européenne comme offrant un niveau de protection adéquat. Elles sont chiffrées en transit (TLS) et au repos (AES-256), et l’accès est strictement cloisonné par organisation au niveau de la base (PostgreSQL Row Level Security).',
  },
];

export function Faq() {
  const [openId, setOpenId] = useState<string | null>('1');

  return (
    <section className="bg-gradient-to-br from-blue-50/35 via-white to-violet-50/25 py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <h2 className="text-foreground text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Tout ce que vous devez savoir sur REZO360
          </h2>
          <p className="text-muted-foreground mt-4 text-base leading-relaxed">
            Ce que la plateforme change concrètement, à qui elle s’adresse, comment démarrer — et
            ce qu’il advient de vos données.
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
