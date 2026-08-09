import { ChevronDown, MessageSquare } from 'lucide-react';
import { Accordion } from 'radix-ui';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { useDocumentTitle } from '@/lib/use-document-title';

const FAQ_ITEMS = [
  {
    id: 'what-is-nexoratech',
    question: 'Qu’est-ce que NexoraTech ?',
    answer:
      'NexoraTech est une plateforme SaaS de boîte à outils techniques destinée aux techniciens, ingénieurs et étudiants de la fibre optique, des réseaux et de l’électricité. Elle centralise toutes vos calculatrices et convertisseurs dans un cockpit numérique unique, précis et accessible partout.',
  },
  {
    id: 'who-is-it-for',
    question: 'À qui s’adresse NexoraTech ?',
    answer:
      'L’application est conçue pour tous les professionnels et apprenants du secteur technique : techniciens d’intervention terrain, ingénieurs en bureau d’études, installateurs télécoms et réseaux, et étudiants préparant des diplômes techniques (BTS, IUT, Écoles d’ingénieurs).',
  },
  {
    id: 'available-tools',
    question: 'Quels types d’outils sont disponibles ?',
    answer:
      'La plateforme couvre les bilans de liaison optique FTTH (atténuation 1310/1550nm), le sous-réseautage IPv4/v6 (masques CIDR, plages d’hôtes), les calculs de puissance électrique triphasée et de chute de tension (UTE C 15-105), ainsi que diverses calculatrices mathématiques et de conversion.',
  },
  {
    id: 'is-it-free',
    question: 'Quelles sont les différentes formules et est-ce gratuit ?',
    answer:
      'NexoraTech propose une formule 100 % Gratuite sans limitation de durée vous donnant accès à tout le catalogue d’outils. La formule Pro (14,99 €/mois ou 149 €/an) ajoute l’historique illimité, l’export PDF/CSV et les favoris illimités. Une formule Équipe (39,99 €/mois/utilisateur) permet la gestion centralisée d’entreprise.',
  },
  {
    id: 'reliability',
    question: 'Les calculs sont-ils fiables et conformes aux normes ?',
    answer:
      'Absolument. Chaque outil s’appuie sur des algorithmes stricts validés selon les standards internationaux et français (normes ITU-T, IEEE, UTE C 15-105). Les résultats sont présentés avec des chiffres tabulaires pour éviter toute erreur de lecture.',
  },
  {
    id: 'mobile-use',
    question: 'Peut-on utiliser NexoraTech sur mobile sur le terrain ?',
    answer:
      'Oui, l’application est entièrement optimisée pour le terrain. L’interface s’adapte automatiquement aux écrans de smartphones (iOS et Android) avec des boutons faciles à toucher à une main.',
  },
  {
    id: 'saving-tools',
    question: 'Peut-on sauvegarder ses outils préférés ?',
    answer:
      'Oui, en cliquant sur l’étoile présente sur chaque carte d’outil, vous l’ajoutez à vos favoris. Ils apparaissent directement sur votre tableau de bord dès votre connexion.',
  },
  {
    id: 'history-feature',
    question: 'Comment fonctionne l’historique des calculs ?',
    answer:
      'Chaque calcul réalisé lorsque vous êtes connecté est conservé dans votre historique personnel. Vous pouvez retrouver la date, l’outil utilisé, les valeurs d’entrée et le résultat pour vos PV de recette ou vos comptes-rendus.',
  },
] as const;

export default function FaqPage() {
  useDocumentTitle('FAQ');

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <PageHeader
        title="Foire aux questions & Réponses"
        description="Retrouvez ici toutes les explications sur le fonctionnement de NexoraTech, la précision des calculs et la gestion de vos outils."
      />

      <div className="bg-surface/90 border-border/80 shadow-raised rounded-2xl border p-6 sm:p-8 backdrop-blur-md">
        <Accordion.Root type="single" defaultValue="what-is-nexoratech" collapsible className="space-y-4">
          {FAQ_ITEMS.map((item) => (
            <Accordion.Item
              key={item.id}
              value={item.id}
              className="border-border/60 rounded-xl border px-4 py-1 transition-colors data-[state=open]:bg-surface-sunken/60"
            >
              <Accordion.Header className="flex">
                <Accordion.Trigger className="text-foreground hover:text-primary flex flex-1 items-center justify-between py-4 font-semibold text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
                  <span>{item.question}</span>
                  <ChevronDown
                    className="text-subtle-foreground size-4 shrink-0 transition-transform duration-200 ease-out group-data-[state=open]:rotate-180"
                    aria-hidden="true"
                  />
                </Accordion.Trigger>
              </Accordion.Header>

              <Accordion.Content className="text-muted-foreground text-xs leading-relaxed pb-4 pt-1 border-t border-border/40 mt-1">
                {item.answer}
              </Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </div>

      {/* Support & Contact */}
      <div className="bg-surface-sunken border-border/60 mt-12 flex flex-col items-center justify-between gap-4 rounded-2xl border p-6 text-center sm:flex-row sm:text-left sm:p-8">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-xl">
            <MessageSquare className="size-5" />
          </div>
          <div>
            <h3 className="text-foreground font-semibold text-sm">Vous avez une question spécifique ?</h3>
            <p className="text-muted-foreground text-xs">
              Notre équipe d&apos;ingénierie est à votre disposition pour vous répondre.
            </p>
          </div>
        </div>

        <Button asChild size="sm">
          <a href="mailto:contact@nexoratech.fr?subject=Question%20NexoraTech">Nous contacter par e-mail</a>
        </Button>
      </div>
    </div>
  );
}
