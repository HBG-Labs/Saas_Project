import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/cn';

const FAQS = [
  {
    id: '1',
    question: 'Que puis-je faire avec le compte gratuit ?',
    answer:
      'Le compte Free donne accès aux calculatrices et outils techniques pour un utilisateur, sans carte ni limite de durée. La gestion des missions, les comptes rendus et la facturation sont disponibles dans les offres payantes, à partir de Starter.',
  },
  {
    id: '2',
    question: 'Est-ce adapté à mon métier ?',
    answer:
      'REZO360 s’adresse aux indépendants et aux entreprises avec des équipes de terrain : maintenance, BTP, électricité, plomberie, climatisation, réseaux, espaces verts et autres activités d’intervention.',
  },
  {
    id: '3',
    question: 'Puis-je travailler depuis mon téléphone ?',
    answer:
      'Oui. REZO360 s’utilise sur smartphone, tablette et ordinateur. Vous pouvez aussi l’installer sur l’écran d’accueil de votre téléphone, sans passer par un magasin d’applications.',
  },
  {
    id: '4',
    question: 'Quand commence l’essai et faut-il une carte ?',
    answer:
      'L’essai ne commence pas à la création du compte. Vous l’activez depuis votre espace en choisissant une offre payante, dont Business. Une carte est alors demandée. L’essai dure 14 jours et aucun débit n’a lieu avant son échéance. Vous pouvez résilier en ligne. L’essai est accordé une fois par entreprise et moyen de paiement, selon les conditions générales.',
  },
  {
    id: '7',
    question: 'Comment choisir la bonne formule ?',
    answer:
      'Commencez par le nombre de personnes et les fonctions dont vous avez besoin. Starter inclut 2 utilisateurs, Pro 5, Business 10 et Enterprise 20. Le comparateur de tarifs détaille les fonctions et permet de simuler les utilisateurs supplémentaires à 5 € par mois.',
  },
  {
    id: '8',
    question: 'À qui poser mes questions avant de commencer ?',
    answer:
      'Écrivez-nous à contact@rezo360.fr en précisant votre métier, la taille de votre équipe et les tâches que vous souhaitez centraliser. Vous pouvez aussi utiliser le bouton d’assistance présent sur le site.',
  },
  {
    id: '5',
    question: 'L’IA décide-t-elle à ma place ?',
    answer:
      'Vous gardez la main. La transcription et l’assistant vous aident à retrouver et à structurer l’information. Vous relisez les contenus proposés avant de les utiliser dans vos documents.',
  },
  {
    id: '6',
    question: 'Comment les accès sont-ils protégés ?',
    answer:
      'Les droits de chaque membre dépendent de son rôle. Les données sont cloisonnées par organisation, chiffrées pendant leur transfert et au repos. Elles sont hébergées au Canada.',
  },
] as const;

export function Faq() {
  const [openId, setOpenId] = useState<string | null>('1');

  return (
    <section id="questions" className="lp-faq" aria-labelledby="lp-faq-title">
      <div className="lp-container lp-faq__grid">
        <div className="lp-faq__heading">
          <p className="lp-eyebrow">Avant de commencer</p>
          <h2 id="lp-faq-title">
            Avant de créer <br />
            votre compte.
          </h2>
          <p>Quelques réponses pour faire le premier pas.</p>
        </div>
        <div className="lp-faq__items">
          {FAQS.map((faq) => {
            const isOpen = openId === faq.id;
            const triggerId = `lp-faq-trigger-${faq.id}`;
            const panelId = `lp-faq-panel-${faq.id}`;

            return (
              <div key={faq.id} className={cn('lp-faq__item', isOpen && 'is-open')}>
                <h3>
                  <button
                    id={triggerId}
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : faq.id)}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className="lp-faq__question"
                  >
                    <span>{faq.question}</span>
                    <ChevronDown
                      className={cn('lp-faq__chevron', isOpen && 'rotate-180')}
                      aria-hidden="true"
                    />
                  </button>
                </h3>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={triggerId}
                  hidden={!isOpen}
                  className="lp-faq__answer"
                >
                  {faq.answer}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
