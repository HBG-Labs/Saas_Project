import { describe, expect, it } from 'vitest';

import { AVATARS, AVATAR_PAR_DEFAUT, cheminAvatar, estAvatarConnu } from './avatars';

/**
 * Ce fichier est GÉNÉRÉ par `scripts/generate-avatars.mjs`. Ces tests ne
 * portent donc pas sur le contenu artistique — c'est le générateur qui en
 * répond — mais sur les GARANTIES que le reste de l'application tient pour
 * acquises : exactement 50 entrées, des identifiants uniques et bien formés,
 * un repli défini. Une régression ici casserait silencieusement la galerie
 * ou la validation côté serveur (`profiles_avatar_id_format`), sans qu'aucun
 * autre test ne le remarque.
 */
describe('catalogue des avatars', () => {
  it('déclare exactement 50 avatars', () => {
    expect(AVATARS).toHaveLength(50);
  });

  it('donne à chaque avatar un identifiant unique', () => {
    const ids = AVATARS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('nomme chaque identifiant selon le format que la base valide', () => {
    // `profiles_avatar_id_format` exige `^avatar-[0-9]{2}$`. Une divergence
    // ici produirait un choix affiché dans la galerie que le serveur
    // refuserait à l'enregistrement.
    for (const avatar of AVATARS) {
      expect(avatar.id, avatar.id).toMatch(/^avatar-[0-9]{2}$/);
    }
  });

  it('désigne un avatar par défaut qui existe réellement dans la collection', () => {
    expect(AVATARS.some((a) => a.id === AVATAR_PAR_DEFAUT)).toBe(true);
  });
});

describe('estAvatarConnu', () => {
  it('reconnaît un identifiant de la collection courante', () => {
    expect(estAvatarConnu('avatar-01')).toBe(true);
  });

  it('rejette un ancien identifiant de la bibliothèque supprimée', () => {
    expect(estAvatarConnu('tech-male-1')).toBe(false);
  });

  it('rejette l’absence de choix sans lever d’erreur', () => {
    expect(estAvatarConnu(null)).toBe(false);
    expect(estAvatarConnu(undefined)).toBe(false);
  });
});

describe('cheminAvatar', () => {
  it('construit le chemin statique servi depuis public/', () => {
    expect(cheminAvatar('avatar-23')).toBe('/avatars/avatar-23.svg');
  });
});
