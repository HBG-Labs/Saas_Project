import { useState } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';

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
      'Absolument. Vous bénéficiez de 14 jours d’essai gratuit sans carte bancaire sur les formules payantes, ainsi que d’un plan Gratuit permanent sans limite de temps.',
  },
  {
    id: '5',
    question: 'Comment mes données d’entreprise sont-elles protégées ?',
    answer:
      'Toutes vos données sont hébergées en Europe et chiffrées de bout en bout (AES-256). L’accès est strictement cloisonné par organisation (PostgreSQL Row Level Security).',
  },
];

export function Faq() {
  const [openId, setOpenId] = useState<string | null>('1');

  return (
    <section className="py-16 sm:py-24 bg-transparent text-white">
      <div className="mx-auto max-w-[1600px] px-3 sm:px-5 lg:px-6 flex justify-start lg:justify-end">
        {/* Contenu entièrement positionné à droite sur desktop, pleine largeur fluide sur mobile/tablette */}
        <div className="w-full max-w-2xl lg:max-w-3xl text-left flex flex-col items-start space-y-6">
          {/* En-tête de section */}
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-none border border-cyan-500/30 bg-cyan-950/40 px-3.5 py-1 text-xs font-bold text-cyan-300 shadow-xs">
              <Sparkles className="size-3.5 text-cyan-400" />
              <span>Questions Fréquentes</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
              Tout ce que vous devez savoir sur REZO360
            </h2>
            <p className="text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed font-normal">
              Des réponses claires et immédiates sur nos outils, la conformité de nos calculateurs et la sécurité de vos données.
            </p>
          </div>

          {/* 5 Questions Clés avec Aisance Horizontale et Bords Carrés */}
          <div className="space-y-3 w-full pt-1">
            {FAQS.map((faq) => {
              const isOpen = openId === faq.id;
              return (
                <div
                  key={faq.id}
                  className={`overflow-hidden rounded-none border transition-all duration-200 bg-transparent ${
                    isOpen
                      ? 'border-cyan-500/50'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : faq.id)}
                    className="flex w-full items-center justify-between p-4 sm:p-5 text-left text-xs sm:text-sm font-bold text-white transition-colors hover:text-cyan-300 cursor-pointer gap-3"
                  >
                    <span className="leading-snug">{faq.question}</span>
                    <ChevronDown
                      className={`size-4 shrink-0 text-slate-400 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-cyan-400' : ''
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div className="border-t border-white/10 p-4 sm:p-5 text-xs sm:text-sm leading-relaxed text-slate-300 bg-transparent">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

