import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: "Qu'est-ce que NexoraTech exactement ?",
      answer:
        "NexoraTech est la plateforme SaaS tout-en-un centralisant des calculateurs normés, des assistants numériques alimentés par l'IA et un hub de documentation technique pour les techniciens, ingénieurs et entreprises.",
    },
    {
      question: 'Comment fonctionne le mode hors-ligne (Offline) ?',
      answer:
        "NexoraTech s'appuie sur la technologie PWA (Progressive Web App). Toutes vos données et calculateurs clés sont stockés localement sur votre appareil. Vous pouvez travailler sans connexion, et l'application se synchronise automatiquement dès le retour du réseau.",
    },
    {
      question: 'Les calculateurs sont-ils conformes aux normes industrielles ?',
      answer:
        'Oui. Tous nos algorithmes de calcul sont rigoureusement audités et mis à jour selon les normes officielles ISO, NF, CEI et IEEE. Les formules exactes et références de normes sont affichées dans chaque outil.',
    },
    {
      question: 'Puis-je tester NexoraTech gratuitement sans carte bancaire ?',
      answer:
        'Absolument. Le plan Freemium est gratuit à vie et ne nécessite aucune carte bancaire. Vous accédez immédiatement aux fonctionnalités de base dès la création de votre compte.',
    },
    {
      question: "Comment l'Assistant IA est-il entraîné ? Mes données sont-elles sécurisées ?",
      answer:
        'Notre IA utilise des modèles sécurisés et isolés. Vos données d’entreprise et d’intervention ne sont jamais utilisées pour entraîner des modèles publics. Vos échanges sont chiffrés en AES-256 bits.',
    },
    {
      question: 'Quelle est la différence entre le plan Pro et le plan Enterprise ?',
      answer:
        'Le plan Pro s’adresse aux professionnels indépendants et petites équipes souhaitant un accès illimité. Le plan Enterprise offre la gestion multi-équipes, la connexion SSO, la synchronisation avec vos outils ERP/GMAO internes et un contrat SLA garanti.',
    },
    {
      question: 'Est-il possible d’exporter les comptes-rendus d’intervention en PDF ?',
      answer:
        'Oui, les plans Pro et Enterprise permettent de générer des rapports PDF personnalisés avec le logo de votre entreprise, vos signatures numériques et vos métriques en 1 clic.',
    },
    {
      question: 'NexoraTech est-il compatible avec mon smartphone Android ou iPhone ?',
      answer:
        'Oui, NexoraTech est 100% responsive et optimisé pour tous les navigateurs mobiles (Chrome, Safari, Firefox) ainsi que sous forme d’application PWA installable sur l’écran d’accueil de votre téléphone ou tablette.',
    },
    {
      question: 'Puis-je créer mes propres calculateurs personnalisés pour mon entreprise ?',
      answer:
        'Oui, via le plan Enterprise, notre studio de création vous permet de modéliser vos propres formules métier et de les diffuser instantanément à vos équipes terrain.',
    },
    {
      question: 'Comment s’effectue le déploiement pour une équipe technique de 50 personnes ?',
      answer:
        'Le déploiement prend moins de 5 minutes. Vous invitez vos collaborateurs via adresse e-mail ou annuaire d’entreprise (SSO Google/Microsoft/Okta). Aucune installation lourde n’est requise.',
    },
  ];

  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Foire Aux Questions
          </h2>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Tout ce que vous devez savoir sur NexoraTech
          </p>
        </div>

        <div className="mt-14 space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={faq.question}
                className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white transition-all dark:border-slate-800/80 dark:bg-slate-900"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="flex w-full items-center justify-between p-5 text-left text-sm font-bold text-slate-900 transition-colors hover:text-blue-600 dark:text-white dark:hover:text-blue-400 cursor-pointer"
                >
                  <span>{faq.question}</span>
                  <ChevronDown
                    className={`size-4 text-slate-400 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-blue-600' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 p-5 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:text-slate-400">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
