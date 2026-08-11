/**
 * Module d'images pour la Landing Page de NexoraTech.
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
    id: 'tech-datacenter',
    name: 'Marc V.',
    role: 'Technicien Datacenter & Infrastructure Optique',
    location: 'Salle de serveurs haute densité',
    imageUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80',
    alt: 'Technicien avec casque de sécurité blanc et tablette dans un datacenter',
    badge: 'Habilitation Électrique & Optique',
    quote: 'NexoraTech me permet de calculer le bilan d\'atténuation optique directement au pied de la baie de brassage.',
  },
  {
    id: 'tech-industrial-duo',
    name: 'Sophie & Thomas',
    role: 'Ingénieurs d\'Études & Audit Réseau',
    location: 'Installation industrielle & Réseau UTE',
    imageUrl: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=1200&q=80',
    alt: 'Deux ingénieurs avec casques de chantier blancs analysant des données sur ordinateur portable',
    badge: 'Certification Normes UTE C 15-105',
    quote: 'Nous validons la conformité des bilans de puissance triphasée avant la mise en service officielle.',
  },
  {
    id: 'tech-field-optical',
    name: 'Alexandre D.',
    role: 'Expert Raccordement Fibre FTTH',
    location: 'Intervention armoire de rue / PBO',
    imageUrl: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80',
    alt: 'Technicien télécom avec lunettes et casque de protection',
    badge: 'Contrôle OTDR & Épissures',
    quote: 'Gain de temps immédiat sur les mesures de réflectométrie lors des recettes de raccordement.',
  },
];
