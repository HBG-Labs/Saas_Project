import { ArrowRight, ChevronDown } from 'lucide-react';
import { Accordion } from 'radix-ui';
import { Link } from 'react-router';

import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';

import { Section } from './Section';

const QUESTIONS = [
  {
    question: 'Les outils sont-ils fiables pour un usage professionnel ?',
    answer:
      'Chaque algorithme de calcul s’appuie sur des normes certifiées (ITU-T, IEEE, UTE C 15-105) et est testé unitairement. C’est un outil d’aide précieux pour vos bilans de liaison et de puissance.',
  },
  {
    question: 'Faut-il un compte pour utiliser les calculatrices ?',
    answer:
      'Non. Toutes les calculatrices du catalogue sont consultables et exécutables librement. Un compte gratuit permet de sauvegarder vos favoris et votre historique.',
  },
  {
    question: 'Mes données sont-elles sécurisées et privées ?',
    answer:
      'Oui. La sécurité par ligne (RLS) est appliquée directement dans PostgreSQL Supabase : vos calculs et favoris personnels ne sont accessibles par aucun autre utilisateur.',
  },
  {
    question: 'L’application est-elle optimisée pour les smartphones ?',
    answer:
      'Absolument. L’interface est conçue en priorité pour le terrain : cibles tactiles de 44 px minimum, navigation fluide au pouce et mode sombre pour les milieux peu éclairés.',
  },
] as const;

export function Faq() {
  return (
    <Section id="faq" eyebrow="FAQ" title="Questions fréquentes">
      <Accordion.Root type="single" collapsible className="mx-auto max-w-3xl space-y-3">
        {QUESTIONS.map((item, index) => (
          <Accordion.Item
            key={item.question}
            value={`item-${index}`}
            className="border-border/70 bg-surface rounded-xl border px-4 py-1"
          >
            <Accordion.Header className="flex">
              <Accordion.Trigger className="group focus-visible:ring-ring flex flex-1 items-center justify-between gap-4 py-4 text-left text-sm font-semibold text-foreground focus-visible:ring-2 focus-visible:outline-none rounded-md">
                <span>{item.question}</span>
                <ChevronDown
                  className="text-subtle-foreground size-4 shrink-0 transition-transform duration-200 ease-out group-data-[state=open]:rotate-180"
                  aria-hidden="true"
                />
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="overflow-hidden">
              <p className="text-muted-foreground pb-4 pt-1 text-xs leading-relaxed border-t border-border/40 mt-1">
                {item.answer}
              </p>
            </Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion.Root>

      <div className="mt-10 text-center">
        <Button asChild variant="outline">
          <Link to={ROUTES.faq}>
            Voir toutes les questions et réponses
            <ArrowRight className="size-4 ml-1.5" />
          </Link>
        </Button>
      </div>
    </Section>
  );
}
