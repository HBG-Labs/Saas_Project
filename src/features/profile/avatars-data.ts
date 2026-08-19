import { useSyncExternalStore } from 'react';

export interface ProfileAvatar {
  id: string;
  name: string;
  category: 'boss' | 'tech' | 'artisan' | 'abstract';
  categoryLabel: string;
  gender: 'male' | 'female' | 'neutral';
  genderLabel: string;
  roleDescription: string;
  clothingStyle: string;
  url: string;
}

export const PROFILE_AVATARS: readonly ProfileAvatar[] = [
  {
    id: 'tech-male-1',
    name: 'Alexandre (Technicien Réseaux & Fibre)',
    category: 'tech',
    categoryLabel: 'Technicien Terrain',
    gender: 'male',
    genderLabel: 'Homme',
    roleDescription: 'Technicien télécoms & fibre optique',
    clothingStyle: 'Casque bleu de chantier, polo technique et harnais outillage',
    url: '/avatars/tech-male-1.jpg',
  },
  {
    id: 'boss-male-1',
    name: 'Marcus (Chef d’Entreprise & Gérant)',
    category: 'boss',
    categoryLabel: 'Direction & Patron',
    gender: 'male',
    genderLabel: 'Homme',
    roleDescription: 'Fondateur & Directeur Général',
    clothingStyle: 'Costume sur-mesure bleu marine et chemise blanche',
    url: '/avatars/boss-male-1.jpg',
  },
  {
    id: 'tech-female-1',
    name: 'Sarah (Technicienne Électrotechnique & Sécurité)',
    category: 'tech',
    categoryLabel: 'Technicienne Terrain',
    gender: 'female',
    genderLabel: 'Femme',
    roleDescription: 'Technicienne électricienne haute précision',
    clothingStyle: 'Casque jaune de sécurité et gilet haute visibilité orange',
    url: '/avatars/tech-female-1.jpg',
  },
  {
    id: 'boss-female-1',
    name: 'Elena (Cheffe d’Entreprise & Associée)',
    category: 'boss',
    categoryLabel: 'Direction & Patronne',
    gender: 'female',
    genderLabel: 'Femme',
    roleDescription: 'Présidente & Directrice d’Exploitation',
    clothingStyle: 'Blazer moderne vert émeraude et chemisier soyeux',
    url: '/avatars/boss-female-1.jpg',
  },
  {
    id: 'tech-male-2',
    name: 'David (Expert Climatisation & Froid)',
    category: 'tech',
    categoryLabel: 'Technicien Terrain',
    gender: 'male',
    genderLabel: 'Homme',
    roleDescription: 'Frigoriste & Énergies renouvelables',
    clothingStyle: 'Polo gris technique et lunettes de protection frontales',
    url: '/avatars/tech-male-2.jpg',
  },
  {
    id: 'tech-female-2',
    name: 'Mei (Ingénieure Réseaux & Câblage)',
    category: 'tech',
    categoryLabel: 'Technicienne Terrain',
    gender: 'female',
    genderLabel: 'Femme',
    roleDescription: 'Spécialiste raccordements et data-center',
    clothingStyle: 'Casque blanc technique, veste d’intervention et équipement',
    url: '/avatars/tech-female-2.jpg',
  },
  {
    id: 'boss-male-2',
    name: 'Julien (Directeur Technique & Associé)',
    category: 'boss',
    categoryLabel: 'Direction & Patron',
    gender: 'male',
    genderLabel: 'Homme',
    roleDescription: 'Directeur des Opérations & BE',
    clothingStyle: 'Veste anthracite smart-casual et lunettes stylisées',
    url: '/avatars/boss-male-2.jpg',
  },
  {
    id: 'artisan-male-1',
    name: 'Kévin (Maître Artisan & Électricien)',
    category: 'artisan',
    categoryLabel: 'Artisan & Spécialiste',
    gender: 'male',
    genderLabel: 'Homme',
    roleDescription: 'Chef d’équipe & Maître artisan',
    clothingStyle: 'Casquette de travail et salopette technique atelier',
    url: '/avatars/artisan-male-1.jpg',
  },
  {
    id: 'abstract-cyber-1',
    name: 'Matrice Cyber & Hologramme',
    category: 'abstract',
    categoryLabel: 'Abstrait & Cyber',
    gender: 'neutral',
    genderLabel: 'Abstrait',
    roleDescription: 'Sphère cybernétique holographique et circuits néon',
    clothingStyle: 'Design 3D futuriste avec luminescence bleue & violette',
    url: '/avatars/abstract-cyber-1.jpg',
  },
  {
    id: 'abstract-fluid-2',
    name: 'Ruban Fluide & Ruban Infini',
    category: 'abstract',
    categoryLabel: 'Abstrait & Fluide',
    gender: 'neutral',
    genderLabel: 'Abstrait',
    roleDescription: 'Verre irisé fluide aux teintes corail, magenta et indigo',
    clothingStyle: 'Design 3D organique en verre soufflé et réfractions',
    url: '/avatars/abstract-fluid-2.jpg',
  },
  {
    id: 'abstract-gold-3',
    name: 'Polyèdre Titane & Or Ciselé',
    category: 'abstract',
    categoryLabel: 'Abstrait & Géométrique',
    gender: 'neutral',
    genderLabel: 'Abstrait',
    roleDescription: 'Sculpture géométrique facettée en titane brossé et biseaux or',
    clothingStyle: 'Design 3D minimaliste, luxe et haute précision',
    url: '/avatars/abstract-gold-3.jpg',
  },
  {
    id: 'abstract-energy-4',
    name: 'Cœur Quantique & Vortex Émeraude',
    category: 'abstract',
    categoryLabel: 'Abstrait & Énergie',
    gender: 'neutral',
    genderLabel: 'Abstrait',
    roleDescription: 'Réacteur à plasma vortex vert émeraude et cyan électrique',
    clothingStyle: 'Design 3D d’énergie cinétique et particules spatiales',
    url: '/avatars/abstract-energy-4.jpg',
  },
];

const AVATAR_STORAGE_KEY = 'rezo360_active_avatar_url';

let currentAvatarUrl: string | null =
  typeof window !== 'undefined'
    ? localStorage.getItem(AVATAR_STORAGE_KEY) || '/avatars/tech-male-1.jpg'
    : '/avatars/tech-male-1.jpg';

const listeners = new Set<() => void>();

function emitChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function setGlobalAvatarUrl(url: string | null): void {
  currentAvatarUrl = url;
  if (typeof window !== 'undefined') {
    if (url) {
      localStorage.setItem(AVATAR_STORAGE_KEY, url);
    } else {
      localStorage.removeItem(AVATAR_STORAGE_KEY);
    }
  }
  emitChange();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): string | null {
  return currentAvatarUrl;
}

function getServerSnapshot(): string | null {
  return '/avatars/tech-male-1.jpg';
}

export function useAvatarStore(): {
  avatarUrl: string | null;
  setAvatarUrl: (url: string | null) => void;
} {
  const avatarUrl = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    avatarUrl,
    setAvatarUrl: setGlobalAvatarUrl,
  };
}
