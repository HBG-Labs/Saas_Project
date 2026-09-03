import { describe, expect, it } from 'vitest';

import { nouvelIdentifiantPourAncienneUrl } from './useMigrateLegacyAvatar';

/**
 * Seule la correspondance ANCIENNE URL → NOUVEL IDENTIFIANT est testée ici :
 * c'est une fonction pure, séparée à dessein de l'effet qui la déclenche
 * (lequel dépend de l'authentification, du profil distant et de
 * `localStorage` — testé par la logique de garde, pas par cette table).
 */
describe('nouvelIdentifiantPourAncienneUrl', () => {
  it('convertit une ancienne URL connue vers un identifiant de la nouvelle bibliothèque', () => {
    expect(nouvelIdentifiantPourAncienneUrl('/avatars/tech-male-1.jpg')).toBe('avatar-01');
    expect(nouvelIdentifiantPourAncienneUrl('/avatars/abstract-energy-4.jpg')).toBe('avatar-12');
  });

  it('renvoie null pour toute URL qui ne correspond à aucun ancien avatar', () => {
    expect(nouvelIdentifiantPourAncienneUrl('/avatars/inexistant.jpg')).toBeNull();
    expect(nouvelIdentifiantPourAncienneUrl('/avatars/avatar-01.svg')).toBeNull();
  });

  it('produit un identifiant valide pour chacune des douze anciennes valeurs possibles', () => {
    // La garantie qui compte réellement : peu importe ce que l'ancienne clé
    // contenait, le résultat — s'il n'est pas null — respecte le format que
    // `profiles_avatar_id_format` exige en base.
    const anciennes = [
      'tech-male-1', 'boss-male-1', 'tech-female-1', 'boss-female-1',
      'tech-male-2', 'tech-female-2', 'boss-male-2', 'artisan-male-1',
      'abstract-cyber-1', 'abstract-fluid-2', 'abstract-gold-3', 'abstract-energy-4',
    ];

    for (const nom of anciennes) {
      const resultat = nouvelIdentifiantPourAncienneUrl(`/avatars/${nom}.jpg`);
      expect(resultat, nom).toMatch(/^avatar-[0-9]{2}$/);
    }
  });
});
