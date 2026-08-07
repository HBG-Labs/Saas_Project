import { ChevronDown } from 'lucide-react';
import { Accordion } from 'radix-ui';

import { Section } from './Section';

const QUESTIONS = [
  {
    question: 'Les outils sont-ils fiables pour un usage professionnel ?',
    answer:
      'La logique de calcul de chaque outil est isolée de l’interface et couverte par des tests unitaires. Cela dit, NexoraTech est un outil d’aide : les résultats doivent être validés selon les normes et procédures applicables à votre intervention.',
  },
  {
    question: 'Faut-il un compte pour utiliser les outils ?',
    answer:
      'Non. Le catalogue et les outils sont consultables librement. Un compte n’est nécessaire que pour conserver vos favoris, votre historique et vos paramètres d’un appareil à l’autre.',
  },
  {
    question: 'Mes données sont-elles accessibles à d’autres utilisateurs ?',
    answer:
      'Non. L’isolation est appliquée directement au niveau de la base de données par des politiques de sécurité par ligne : techniquement, une requête ne peut pas retourner les données d’un autre compte, même en cas d’erreur applicative.',
  },
  {
    question: 'L’application fonctionne-t-elle sur téléphone ?',
    answer:
      'Oui. L’interface est conçue en priorité pour le mobile : navigation basse accessible au pouce, cibles tactiles de 44 pixels minimum, et mode sombre pour les interventions en environnement peu éclairé.',
  },
  {
    question: 'Quels outils sont disponibles aujourd’hui ?',
    answer:
      'La plateforme est en construction. Les quatre catégories — fibre optique, réseaux, électricité et calculs généraux — sont en place, et les outils y sont ajoutés progressivement. Chaque nouvel outil est publié dès qu’il est testé.',
  },
  {
    question: 'Puis-je proposer un outil ?',
    answer:
      'Oui, et c’est encouragé. L’architecture a été conçue pour qu’un nouvel outil s’ajoute sans modifier le reste de la plateforme : les suggestions de terrain sont la meilleure source de priorisation.',
  },
] as const;

export function Faq() {
  return (
    <Section id="faq" eyebrow="FAQ" title="Questions fréquentes">
      <Accordion.Root type="single" collapsible className="mx-auto max-w-3xl">
        {QUESTIONS.map((item, index) => (
          <Accordion.Item
            key={item.question}
            value={`item-${index}`}
            className="border-border border-b"
          >
            <Accordion.Header>
              <Accordion.Trigger className="group focus-visible:ring-ring flex w-full items-center justify-between gap-4 py-4 text-left text-base font-medium focus-visible:ring-2 focus-visible:outline-none">
                {item.question}
                <ChevronDown
                  className="text-subtle-foreground size-4 shrink-0 transition-transform duration-[180ms] group-data-[state=open]:rotate-180"
                  aria-hidden="true"
                />
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="overflow-hidden">
              <p className="text-muted-foreground pb-4 text-sm">{item.answer}</p>
            </Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion.Root>
    </Section>
  );
}
