/**
 * Module d'images pour la Landing Page de REZO360.
 * Photos d'ingénieurs et techniciens de terrain équipés de casques de sécurité.
 */

export interface FieldTechnician {
  id: string;
  name: string;
  role: string;
  location: string;
  imageUrl: string;
  alt: string;
  badge: string;
  quote: string;
}

export const FIELD_TECHNICIANS: FieldTechnician[] = [
  {
    id: 'tech-field-telecom',
    name: 'Samuel M. & Équipe Déploiement',
    role: 'Technicien Télécoms & Raccordement Fibre Optique',
    location: 'Chantier Déploiement FTTH · Armoire HUB-4B',
    imageUrl: '/images/hero-telecom-field.jpg',
    alt: 'Technicien télécoms avec casque et gilet de sécurité tenant une tablette devant une armoire fibre optique HUB 4B',
    badge: 'Certification Réflectométrie & Épissure',
    quote: 'Avec REZO360 sur tablette, je valide les soudures, le bilan optique et la recette client directement au pied de l\'armoire.',
  },
  {
    id: 'tech-supervisors-cockpit',
    name: 'Laurent & Équipe Exploitation',
    role: 'Superviseurs d’Opérations & Pilotage Chantiers',
    location: 'Cockpit Central · Supervision Multi-Équipes',
    imageUrl: '/images/cockpit-supervisors.png',
    alt: 'Responsables techniques analysant les plannings et métriques de performance sur tablette et écran d\'ordinateur',
    badge: 'Supervision Opérationnelle 24/7',
    quote: 'La synchronisation en temps réel avec nos équipes sur le terrain a réduit nos temps de validation de 45%.',
  },
  {
    id: 'tech-field-inspection',
    name: 'Amina & Thomas',
    role: 'Contrôleurs Techniques & Conformité Réglementaire',
    location: 'Site Industriel · Vérification Équipements',
    imageUrl: '/images/field-inspection-team.jpg',
    alt: 'Binôme de techniciens en tenue de sécurité et casques consultant une check-list numérique sur tablette',
    badge: 'Conformité Normes NF & UTE',
    quote: 'Toutes nos fiches d\'intervention et signatures clients sont générées et horodatées sans aucune saisie papier.',
  },
];

/**
 * Même jeu de photos, sous la forme attendue par la bannière du tableau de bord
 * technicien.
 *
 * Une projection plutôt qu'un second tableau : les deux écrans montrent les
 * mêmes personnes, et deux listes à maintenir en parallèle finiraient par
 * diverger. Seuls les noms de champs changent, la landing parlant de
 * « technicien » là où la bannière parle d'« image ».
 */
export interface TechnicianImage {
  url: string;
  alt: string;
  title: string;
  role: string;
  environment: string;
  badgeText: string;
}

export const TECHNICIAN_IMAGES: TechnicianImage[] = FIELD_TECHNICIANS.map((technician) => ({
  url: technician.imageUrl,
  alt: technician.alt,
  title: technician.name,
  role: technician.role,
  environment: technician.location,
  badgeText: technician.badge,
}));
