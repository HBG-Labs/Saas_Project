import { useState } from 'react';
import { ChevronDown, Sparkles, ShieldCheck, Cpu, Layers } from 'lucide-react';

interface FaqItem {
  id: string;
  category: 'platform' | 'security' | 'billing';
  question: string;
  answer: string;
}

const CATEGORIES = [
  { id: 'all', label: 'Toutes les questions', icon: Layers },
  { id: 'platform', label: 'Plateforme & Outils', icon: Cpu },
  { id: 'security', label: 'Sécurité & IA', icon: ShieldCheck },
  { id: 'billing', label: 'Abonnements & Équipes', icon: Sparkles },
] as const;

const FAQS: FaqItem[] = [
  {
    id: '1',
    category: 'platform',
    question: "Qu'est-ce que REZO360 exactement ?",
    answer:
      "REZO360 est la plateforme SaaS tout-en-un centralisant des calculateurs normés, des assistants numériques alimentés par l'IA et un hub de gestion technique pour les techniciens, ingénieurs et entreprises.",
  },
  {
    id: '2',
    category: 'platform',
    question: 'Les calculateurs sont-ils conformes aux normes ?',
    answer:
      'Oui. Tous nos algorithmes sont audités et mis à jour selon les normes officielles ISO, NF C 15-100, CEI et IEEE. Les formules exactes sont affichées en direct dans chaque outil.',
  },
  {
    id: '3',
    category: 'platform',
    question: 'Comment fonctionne le mode hors-ligne (Offline) ?',
    answer:
      "REZO360 s'appuie sur la technologie PWA. Vos données et outils clés sont stockés localement sur votre appareil. Vous travaillez sans réseau et l'application se synchronise automatiquement au retour de la connexion.",
  },
  {
    id: '4',
    category: 'platform',
    question: 'Est-ce compatible avec mon smartphone iOS ou Android ?',
    answer:
      'Oui, REZO360 est 100% responsive et optimisé pour tous les navigateurs mobiles ainsi que sous forme d’application PWA installable en 1 clic sur votre écran d’accueil.',
  },
  {
    id: '5',
    category: 'security',
    question: "Comment l'Assistant IA est-il entraîné ? Vos données sont-elles sécurisées ?",
    answer:
      'Notre IA utilise des modèles souverains et isolés. Vos données d’entreprise ne sont jamais utilisées pour entraîner des modèles publics. Les flux sont chiffrés en AES-256 bits.',
  },
  {
    id: '6',
    category: 'security',
    question: 'Puis-je créer mes propres calculateurs personnalisés ?',
    answer:
      'Oui, avec l’offre Entreprise, notre studio de création vous permet de modéliser vos propres formules métier et de les diffuser instantanément à vos équipes terrain.',
  },
  {
    id: '7',
    category: 'billing',
    question: 'Puis-je utiliser REZO360 gratuitement ?',
    answer:
      'Absolument. Le plan Gratuit est accessible sans limite de temps et sans carte bancaire pour découvrir les outils et effectuer vos premiers calculs.',
  },
  {
    id: '8',
    category: 'billing',
    question: 'Quelle est la différence entre le plan Pro et le plan Entreprise ?',
    answer:
      'Le plan Pro s’adresse aux techniciens et ingénieurs individuels (historique illimité, exports PDF/CSV certifiés). Le plan Entreprise ajoute la gestion d’équipe, le SSO, l’espace partagé et un SLA garanti.',
  },
  {
    id: '9',
    category: 'billing',
    question: 'Est-il possible d’exporter les rapports d’intervention en PDF ?',
    answer:
      'Oui, les plans Pro et Entreprise permettent de générer des rapports PDF certifiés et personnalisés avec le logo de votre entreprise et vos signatures numériques.',
  },
  {
    id: '10',
    category: 'billing',
    question: 'Comment s’effectue le déploiement pour une équipe ?',
    answer:
      'Le déploiement prend moins de 5 minutes : vous invitez vos collaborateurs par e-mail ou via l’annuaire d’entreprise SSO (Google, Microsoft, Okta). Aucune installation lourde requise.',
  },
];

export function Faq() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [openId, setOpenId] = useState<string | null>('1');

  const filteredFaqs =
    selectedCategory === 'all' ? FAQS : FAQS.filter((faq) => faq.category === selectedCategory);

  return (
    <section className="py-16 sm:py-24 border-t border-border/60">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* En-tête de section */}
        <div className="text-center space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Foire Aux Questions
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Tout ce que vous devez savoir sur REZO360
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
            Trouvez rapidement des réponses claires sur nos outils, la sécurité de vos données et nos offres.
          </p>
        </div>

        {/* Filtres par catégories (Pills) */}
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="size-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Grille 2 Colonnes d'Accordéons compacts */}
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          {filteredFaqs.map((faq) => {
            const isOpen = openId === faq.id;
            return (
              <div
                key={faq.id}
                className={`overflow-hidden rounded-2xl border transition-all duration-200 ${
                  isOpen
                    ? 'border-blue-500/50 bg-white shadow-md dark:border-blue-500/40 dark:bg-slate-900'
                    : 'border-slate-200/80 bg-white/80 hover:border-slate-300 dark:border-slate-800/80 dark:bg-slate-900/60 dark:hover:border-slate-700'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : faq.id)}
                  className="flex w-full items-center justify-between p-4 sm:p-5 text-left text-xs sm:text-sm font-bold text-slate-900 transition-colors hover:text-blue-600 dark:text-white dark:hover:text-blue-400 cursor-pointer gap-3"
                >
                  <span className="leading-snug">{faq.question}</span>
                  <ChevronDown
                    className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-blue-600 dark:text-blue-400' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 dark:border-slate-800 p-4 sm:p-5 text-xs leading-relaxed text-slate-600 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-950/40">
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

