import {
  Boxes,
  ClipboardCheck,
  FileCheck2,
  Landmark,
  MapPinned,
  ReceiptText,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { ROUTES } from '@/config/routes';

export type TrainingTheme = 'Démarrage' | 'Pilotage' | 'Terrain' | 'Gestion';

export interface TrainingAction {
  label: string;
  to: string;
}

export interface TrainingChapter {
  id: string;
  title: string;
  duration: string;
  objective: string;
  steps: readonly string[];
  tip?: string;
  warning?: string;
  action?: TrainingAction;
}

export interface TrainingCourse {
  slug: string;
  title: string;
  shortTitle: string;
  summary: string;
  description: string;
  duration: string;
  level: 'Débutant' | 'Intermédiaire';
  audience: string;
  theme: TrainingTheme;
  icon: LucideIcon;
  featured?: boolean;
  chapters: readonly TrainingChapter[];
}

export const TRAINING_THEMES: readonly (TrainingTheme | 'Tous')[] = [
  'Tous',
  'Démarrage',
  'Pilotage',
  'Terrain',
  'Gestion',
];

export const TRAINING_COURSES: readonly TrainingCourse[] = [
  {
    slug: 'bien-demarrer',
    title: 'Bien démarrer avec REZO360',
    shortTitle: 'Bien démarrer',
    summary: 'Configurez votre entreprise et prenez vos premiers repères dans l’application.',
    description:
      'Le parcours conseillé pour comprendre l’organisation de REZO360, préparer votre espace et trouver rapidement chaque fonction.',
    duration: '12 min',
    level: 'Débutant',
    audience: 'Toute l’équipe',
    theme: 'Démarrage',
    icon: MapPinned,
    featured: true,
    chapters: [
      {
        id: 'profil-entreprise',
        title: 'Préparer le profil de l’entreprise',
        duration: '3 min',
        objective: 'Renseigner une identité claire avant de créer des documents commerciaux.',
        steps: [
          'Ouvrez Entreprise depuis le menu Administration.',
          'Vérifiez le nom, l’activité et les coordonnées principales.',
          'Enregistrez les changements avant de passer à la suite.',
        ],
        action: { label: 'Ouvrir les paramètres Entreprise', to: ROUTES.organization },
      },
      {
        id: 'equipe',
        title: 'Inviter et organiser l’équipe',
        duration: '3 min',
        objective: 'Donner à chaque personne le bon rôle et le bon niveau d’accès.',
        steps: [
          'Ouvrez Techniciens, puis invitez un membre avec son adresse e-mail.',
          'Choisissez son rôle selon ses responsabilités réelles.',
          'Créez ensuite les équipes de terrain utiles à votre organisation.',
        ],
        tip: 'Commencez avec une seule personne test avant d’inviter toute l’équipe.',
        action: { label: 'Gérer les membres', to: ROUTES.organizationMembers },
      },
      {
        id: 'navigation',
        title: 'Se repérer dans REZO360',
        duration: '3 min',
        objective: 'Trouver une page sans parcourir tous les menus.',
        steps: [
          'Utilisez les groupes du menu latéral pour accéder aux modules.',
          'Sur ordinateur, réduisez le menu si vous souhaitez agrandir la zone de travail.',
          'Utilisez Ctrl+K ou ⌘K pour rechercher une page ou un outil.',
        ],
        action: { label: 'Revenir au tableau de bord', to: ROUTES.dashboard },
      },
      {
        id: 'premier-parcours',
        title: 'Suivre le parcours quotidien',
        duration: '3 min',
        objective: 'Comprendre le fil logique entre client, mission et compte rendu.',
        steps: [
          'Créez d’abord le client et son site.',
          'Planifiez une mission et affectez-la à un technicien.',
          'Terminez l’intervention par un compte rendu contrôlé et signé.',
        ],
        action: { label: 'Créer votre premier client', to: ROUTES.customers },
      },
    ],
  },
  {
    slug: 'clients-et-sites',
    title: 'Gérer les clients et leurs sites',
    shortTitle: 'Clients & sites',
    summary: 'Centralisez les coordonnées, adresses de chantier et données de facturation.',
    description:
      'Apprenez à créer une fiche fiable, distinguer un client particulier d’une entreprise et préparer les informations réutilisées dans les devis et factures.',
    duration: '10 min',
    level: 'Débutant',
    audience: 'Direction et gestionnaires',
    theme: 'Pilotage',
    icon: Users,
    chapters: [
      {
        id: 'creer-client',
        title: 'Créer une fiche client',
        duration: '3 min',
        objective: 'Enregistrer les coordonnées indispensables sans ressaisie ultérieure.',
        steps: [
          'Ouvrez Clients et choisissez l’ajout d’un nouveau client.',
          'Sélectionnez le type de client : particulier ou professionnel.',
          'Renseignez le nom, le contact, l’adresse et les coordonnées utiles.',
        ],
        action: { label: 'Ouvrir les clients', to: ROUTES.customers },
      },
      {
        id: 'identifiants',
        title: 'Compléter les identifiants professionnels',
        duration: '3 min',
        objective: 'Préparer une fiche exploitable pour la facturation électronique.',
        steps: [
          'Pour une entreprise, renseignez sa raison sociale et son SIRET.',
          'Ajoutez le numéro de TVA lorsqu’il s’applique.',
          'Vérifiez le code postal, la ville et le code pays à deux lettres.',
        ],
        warning:
          'Utilisez les informations légales réelles du client pour une facture de production.',
      },
      {
        id: 'sites',
        title: 'Ajouter les sites d’intervention',
        duration: '2 min',
        objective: 'Séparer l’adresse administrative des lieux où les équipes interviennent.',
        steps: [
          'Ouvrez la fiche du client puis la section Sites.',
          'Ajoutez un nom reconnaissable et l’adresse exacte de chaque site.',
          'Sélectionnez ensuite le bon site lors de la création d’une mission.',
        ],
      },
      {
        id: 'verification',
        title: 'Contrôler la fiche avant utilisation',
        duration: '2 min',
        objective: 'Éviter qu’une erreur d’adresse se propage dans les documents.',
        steps: [
          'Relisez les informations de contact et de facturation.',
          'Corrigez la fiche client avant de créer le devis si une donnée est erronée.',
          'Conservez les informations propres à une facture dans son brouillon.',
        ],
      },
    ],
  },
  {
    slug: 'missions-et-planning',
    title: 'Planifier et suivre les missions',
    shortTitle: 'Missions & planning',
    summary: 'Créez une mission, affectez les intervenants et suivez l’avancement terrain.',
    description:
      'Un parcours complet pour passer d’une demande client à une intervention planifiée, visible par les bonnes personnes.',
    duration: '16 min',
    level: 'Débutant',
    audience: 'Responsables et techniciens',
    theme: 'Pilotage',
    icon: ClipboardCheck,
    chapters: [
      {
        id: 'creer-mission',
        title: 'Créer une mission exploitable',
        duration: '4 min',
        objective: 'Décrire clairement le travail attendu et son contexte.',
        steps: [
          'Choisissez le client et, si nécessaire, le site d’intervention.',
          'Ajoutez un titre, une description précise et le niveau de priorité.',
          'Joignez les informations dont le technicien aura besoin sur place.',
        ],
        action: { label: 'Créer une mission', to: ROUTES.missionNew },
      },
      {
        id: 'affecter',
        title: 'Affecter les bonnes personnes',
        duration: '3 min',
        objective: 'Rendre la mission visible dans le planning du technicien concerné.',
        steps: [
          'Affectez une équipe ou un technicien disponible.',
          'Définissez une date et une plage horaire réalistes.',
          'Vérifiez les éventuels conflits directement dans le planning.',
        ],
        action: { label: 'Consulter le planning', to: ROUTES.planning },
      },
      {
        id: 'terrain',
        title: 'Suivre l’intervention sur le terrain',
        duration: '4 min',
        objective: 'Conserver un état d’avancement compréhensible par toute l’équipe.',
        steps: [
          'Le technicien ouvre sa mission depuis son tableau de bord ou son planning.',
          'Il démarre l’intervention et consigne les informations utiles.',
          'Il ajoute les photos et réponses demandées avant de terminer.',
        ],
        tip: 'Sur mobile, installez REZO360 pour retrouver l’application comme une application classique.',
      },
      {
        id: 'cloturer',
        title: 'Clôturer et retrouver le dossier',
        duration: '5 min',
        objective: 'Finaliser la mission avec un historique complet.',
        steps: [
          'Vérifiez le compte rendu et demandez les corrections nécessaires.',
          'Validez la mission lorsque toutes les informations sont présentes.',
          'Retrouvez ensuite les dossiers terminés dans les archives.',
        ],
        action: { label: 'Voir les missions', to: ROUTES.missions },
      },
    ],
  },
  {
    slug: 'rapports-intervention',
    title: 'Rédiger et valider les comptes rendus',
    shortTitle: 'Comptes rendus',
    summary: 'Documentez le travail, ajoutez les preuves et obtenez une validation propre.',
    description:
      'Ce cours montre comment produire un compte rendu lisible, le faire contrôler et conserver les éléments de preuve de l’intervention.',
    duration: '14 min',
    level: 'Débutant',
    audience: 'Techniciens et responsables',
    theme: 'Terrain',
    icon: FileCheck2,
    chapters: [
      {
        id: 'saisie',
        title: 'Renseigner le travail réalisé',
        duration: '4 min',
        objective: 'Produire un récit utile au client et au responsable.',
        steps: [
          'Décrivez les actions réellement effectuées avec des termes précis.',
          'Indiquez les anomalies constatées et les suites recommandées.',
          'Enregistrez régulièrement le brouillon sur le terrain.',
        ],
        action: { label: 'Ouvrir les comptes rendus', to: ROUTES.reports },
      },
      {
        id: 'preuves',
        title: 'Ajouter photos et pièces utiles',
        duration: '3 min',
        objective: 'Associer les preuves au bon dossier.',
        steps: [
          'Ajoutez des photos lisibles avant, pendant ou après l’intervention.',
          'Vérifiez que chaque pièce jointe concerne bien la mission ouverte.',
          'Évitez les documents contenant des données personnelles inutiles.',
        ],
      },
      {
        id: 'signature',
        title: 'Faire relire et signer',
        duration: '3 min',
        objective: 'Obtenir une confirmation claire de la fin d’intervention.',
        steps: [
          'Présentez le résumé au client avant la signature.',
          'Corrigez les informations factuelles si nécessaire.',
          'Recueillez la signature une fois le contenu compris et accepté.',
        ],
      },
      {
        id: 'controle',
        title: 'Contrôler et valider le rapport',
        duration: '4 min',
        objective: 'Faire passer le rapport de la file de contrôle à l’archive.',
        steps: [
          'Ouvrez Rapports & Contrôle pour retrouver les éléments à vérifier.',
          'Demandez une correction si une information manque.',
          'Validez lorsque le document est complet et cohérent.',
        ],
        action: { label: 'Ouvrir la file de contrôle', to: ROUTES.review },
      },
    ],
  },
  {
    slug: 'devis-et-factures',
    title: 'Passer du devis à la facture',
    shortTitle: 'Devis & factures',
    summary: 'Créez un devis, faites-le accepter et transformez-le en facture sans ressaisie.',
    description:
      'Le parcours commercial de REZO360 expliqué de bout en bout, avec les vérifications à effectuer avant de figer une facture.',
    duration: '15 min',
    level: 'Intermédiaire',
    audience: 'Direction et gestionnaires',
    theme: 'Gestion',
    icon: ReceiptText,
    chapters: [
      {
        id: 'devis',
        title: 'Créer le devis',
        duration: '4 min',
        objective: 'Construire une proposition claire avec les bons montants.',
        steps: [
          'Choisissez le client et ajoutez les prestations du catalogue.',
          'Vérifiez les quantités, prix unitaires et taux de TVA.',
          'Enregistrez le devis puis ouvrez sa fiche détaillée.',
        ],
        action: { label: 'Créer un devis', to: ROUTES.quotes },
      },
      {
        id: 'acceptation',
        title: 'Enregistrer la décision du client',
        duration: '3 min',
        objective: 'Conserver un statut commercial fiable.',
        steps: [
          'Marquez le devis comme envoyé après sa remise au client.',
          'Passez-le à Accepté seulement après avoir reçu son accord.',
          'Un devis refusé ou expiré reste consultable dans l’historique.',
        ],
        action: { label: 'Voir l’historique des devis', to: ROUTES.quotesHistory },
      },
      {
        id: 'brouillon-facture',
        title: 'Créer et corriger le brouillon de facture',
        duration: '4 min',
        objective: 'Reprendre le devis accepté et compléter les mentions manquantes.',
        steps: [
          'Depuis le devis accepté, choisissez Créer la facture.',
          'Ouvrez le brouillon généré et utilisez Corriger le brouillon.',
          'Contrôlez le destinataire, la prestation, l’échéance et les conditions de règlement.',
        ],
        action: { label: 'Ouvrir les factures', to: ROUTES.invoices },
      },
      {
        id: 'emission',
        title: 'Émettre après la dernière vérification',
        duration: '4 min',
        objective: 'Attribuer le numéro définitif au bon moment.',
        steps: [
          'Résolvez chaque information manquante signalée sur la fiche.',
          'Relisez le client, les lignes, la TVA, les dates et les totaux.',
          'Choisissez Émettre la facture, puis confirmez l’émission définitive.',
        ],
        warning:
          'Après émission, la facture reçoit un numéro définitif et son contenu est figé. Une correction comptable passe ensuite par un avoir.',
      },
    ],
  },
  {
    slug: 'stock-et-materiel',
    title: 'Suivre le stock et le matériel',
    shortTitle: 'Stock & matériel',
    summary: 'Enregistrez les articles, les mouvements et les équipements de l’entreprise.',
    description:
      'Apprenez à garder un inventaire exploitable et à distinguer les consommables des équipements suivis individuellement.',
    duration: '11 min',
    level: 'Débutant',
    audience: 'Gestionnaires et équipes terrain',
    theme: 'Gestion',
    icon: Boxes,
    chapters: [
      {
        id: 'articles',
        title: 'Créer les articles courants',
        duration: '3 min',
        objective: 'Constituer un catalogue simple de consommables.',
        steps: [
          'Ajoutez un nom, une référence et une unité compréhensibles.',
          'Renseignez le niveau disponible et, si utile, le seuil d’alerte.',
          'Utilisez une convention de nommage commune à toute l’équipe.',
        ],
        action: { label: 'Ouvrir le stock', to: ROUTES.stock },
      },
      {
        id: 'mouvements',
        title: 'Enregistrer les mouvements',
        duration: '3 min',
        objective: 'Comprendre pourquoi le stock a augmenté ou diminué.',
        steps: [
          'Enregistrez une entrée lors de la réception de fournitures.',
          'Enregistrez une sortie lors de l’utilisation ou de la remise à un technicien.',
          'Ajoutez un motif assez précis pour permettre un contrôle ultérieur.',
        ],
        action: { label: 'Voir les mouvements', to: ROUTES.stockMovements },
      },
      {
        id: 'equipements',
        title: 'Suivre les équipements durables',
        duration: '3 min',
        objective: 'Conserver l’identité et l’état de chaque matériel important.',
        steps: [
          'Créez une fiche par équipement suivi individuellement.',
          'Ajoutez son numéro de série, son état et son affectation.',
          'Mettez la fiche à jour lors d’un changement ou d’une maintenance.',
        ],
        action: { label: 'Ouvrir le matériel', to: ROUTES.equipment },
      },
      {
        id: 'controle-stock',
        title: 'Contrôler les écarts',
        duration: '2 min',
        objective: 'Repérer rapidement une quantité incohérente.',
        steps: [
          'Consultez régulièrement les articles sous leur seuil d’alerte.',
          'Comparez les mouvements avec la quantité réellement disponible.',
          'Corrigez l’origine de l’écart avant le prochain approvisionnement.',
        ],
      },
    ],
  },
  {
    slug: 'facturation-electronique',
    title: 'Utiliser la facturation électronique',
    shortTitle: 'Facturation électronique',
    summary: 'Préparez, émettez et transmettez une facture via SUPER PDP en toute sécurité.',
    description:
      'Un parcours guidé qui sépare chaque étape : préparation de l’entreprise, connexion à SUPER PDP, création du brouillon, émission puis transmission.',
    duration: '20 min',
    level: 'Intermédiaire',
    audience: 'Propriétaires et administrateurs',
    theme: 'Gestion',
    icon: Landmark,
    featured: true,
    chapters: [
      {
        id: 'preparer-emetteur',
        title: '1. Préparer l’entreprise émettrice',
        duration: '4 min',
        objective: 'Compléter les informations qui accompagneront les factures.',
        steps: [
          'Ouvrez Entreprise, puis l’onglet Facturation électronique.',
          'Renseignez la raison sociale, le SIRET, la TVA, l’adresse et le code pays.',
          'Complétez les informations légales et bancaires qui s’appliquent à votre entreprise.',
          'Enregistrez et vérifiez que la préparation de l’émetteur est indiquée comme complète.',
        ],
        warning:
          'En production, utilisez exclusivement l’identité légale réelle de l’entreprise qui émet la facture.',
        action: { label: 'Préparer mon entreprise', to: ROUTES.organizationEinvoicing },
      },
      {
        id: 'connecter-superpdp',
        title: '2. Connecter SUPER PDP',
        duration: '3 min',
        objective: 'Autoriser REZO360 à utiliser le bon compte de plateforme agréée.',
        steps: [
          'Dans la carte SUPER PDP, choisissez Préparer la connexion.',
          'Lorsque le second bouton apparaît, choisissez Continuer sur SUPER PDP.',
          'Sur SUPER PDP, sélectionnez l’entreprise correspondant au SIRET de REZO360.',
          'Autorisez l’accès puis revenez dans REZO360 pour vérifier le statut.',
        ],
        tip: 'Les deux boutons séparent volontairement la préparation sécurisée du départ vers SUPER PDP.',
        warning:
          'Le compte SUPER PDP choisi doit correspondre à l’entreprise configurée dans REZO360.',
        action: { label: 'Configurer SUPER PDP', to: ROUTES.organizationEinvoicing },
      },
      {
        id: 'creer-brouillon',
        title: '3. Créer la facture en brouillon',
        duration: '3 min',
        objective: 'Transformer un devis accepté sans attribuer encore de numéro définitif.',
        steps: [
          'Ouvrez l’historique des devis et sélectionnez un devis accepté.',
          'Choisissez Créer la facture : les lignes, le client et les montants sont repris.',
          'Ouvrez la nouvelle facture dont le statut est Brouillon.',
        ],
        tip: 'Un brouillon peut être corrigé ou supprimé et ne consomme aucun numéro de facture.',
        action: { label: 'Choisir un devis accepté', to: ROUTES.quotesHistory },
      },
      {
        id: 'corriger-brouillon',
        title: '4. Compléter et contrôler le brouillon',
        duration: '4 min',
        objective: 'Résoudre toutes les informations manquantes avant l’émission.',
        steps: [
          'Choisissez Corriger le brouillon sur la fiche de la facture.',
          'Vérifiez le destinataire, son adresse et ses identifiants selon son type.',
          'Renseignez la date de prestation, l’échéance, le mode et les conditions de règlement.',
          'Enregistrez le brouillon puis suivez les liens de correction encore affichés.',
        ],
        action: { label: 'Ouvrir mes factures', to: ROUTES.invoices },
      },
      {
        id: 'emettre',
        title: '5. Émettre la facture',
        duration: '3 min',
        objective: 'Figer le document et lui attribuer sa référence officielle.',
        steps: [
          'Relisez une dernière fois le destinataire, les montants, la TVA et les dates.',
          'Choisissez Émettre la facture lorsque le contrôle ne signale plus de blocage.',
          'Lisez la confirmation puis choisissez Émettre définitivement.',
        ],
        warning:
          'L’émission est une étape engageante : le numéro devient définitif et la facture ne se modifie plus. Utilisez un avoir pour corriger une facture déjà émise.',
      },
      {
        id: 'transmettre',
        title: '6. Transmettre et suivre le statut',
        duration: '3 min',
        objective: 'Déposer volontairement la facture sur SUPER PDP et suivre son traitement.',
        steps: [
          'Sur la facture émise, vérifiez que la connexion SUPER PDP est indiquée comme connectée.',
          'Choisissez Transmettre via SUPER PDP, relisez la confirmation puis validez la transmission définitive.',
          'Consultez ensuite la chronologie et utilisez Actualiser auprès de SUPER PDP pour obtenir le dernier statut.',
          'Téléchargez les formats électroniques proposés si vous avez besoin d’un contrôle ou d’une archive.',
        ],
        warning:
          'La transmission quitte REZO360 pour la plateforme externe. Ne confirmez qu’après la dernière vérification du document.',
        action: { label: 'Ouvrir les factures', to: ROUTES.invoices },
      },
    ],
  },
];

export function getTrainingCourse(slug: string | undefined): TrainingCourse | undefined {
  return TRAINING_COURSES.find((course) => course.slug === slug);
}
