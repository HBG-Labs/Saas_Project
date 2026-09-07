import { describe, expect, it } from 'vitest';

import type { DocumentFolder } from '@/types/domain';

import {
  cheminDe,
  construireArbre,
  descendantsDe,
  destinationsPossibles,
  enfantsDe,
  nomDeDossier,
} from './folder-tree';

function dossier(id: string, name: string, parent: string | null = null): DocumentFolder {
  return {
    id,
    organization_id: 'org-1',
    parent_folder_id: parent,
    name,
    created_by: 'u1',
    created_at: '2026-09-01T10:00:00Z',
    updated_at: '2026-09-01T10:00:00Z',
  };
}

//   Clients
//     └─ Orange
//          └─ Plans
//               └─ 2026
//   Fibre
const ARBRE: DocumentFolder[] = [
  dossier('clients', 'Clients'),
  dossier('orange', 'Orange', 'clients'),
  dossier('plans', 'Plans', 'orange'),
  dossier('an', '2026', 'plans'),
  dossier('fibre', 'Fibre'),
];

describe('enfantsDe', () => {
  it('ne remonte que les enfants directs', () => {
    expect(enfantsDe(ARBRE, 'clients').map((d) => d.id)).toEqual(['orange']);
    expect(enfantsDe(ARBRE, 'an')).toEqual([]);
  });

  it('traite null comme la racine', () => {
    expect(enfantsDe(ARBRE, null).map((d) => d.id)).toEqual(['clients', 'fibre']);
  });

  it('trie sans se laisser piéger par les accents', () => {
    const liste = [dossier('b', 'Zébra'), dossier('a', 'Élagage'), dossier('c', 'agenda')];
    expect(enfantsDe(liste, null).map((d) => d.name)).toEqual(['agenda', 'Élagage', 'Zébra']);
  });
});

describe('construireArbre', () => {
  it('imbrique les niveaux et compte la profondeur', () => {
    const arbre = construireArbre(ARBRE);

    expect(arbre.map((n) => n.dossier.id)).toEqual(['clients', 'fibre']);
    expect(arbre[0]?.profondeur).toBe(0);

    const orange = arbre[0]?.enfants[0];
    expect(orange?.dossier.id).toBe('orange');
    expect(orange?.profondeur).toBe(1);
    expect(orange?.enfants[0]?.enfants[0]?.dossier.name).toBe('2026');
  });

  it('remonte à la racine un dossier dont le parent manque', () => {
    // Le parent peut être absent d'un lot paginé. Masquer l'enfant le rendrait
    // inatteignable ; le montrer au premier niveau reste vrai.
    const orphelin = [dossier('seul', 'Orphelin', 'parent-inconnu')];
    expect(construireArbre(orphelin).map((n) => n.dossier.id)).toEqual(['seul']);
  });

  it('ne boucle pas sur un cycle présent dans les données', () => {
    // La base l'interdit ; une liste corrompue ou tronquée ne doit pas pour
    // autant figer le navigateur.
    const cycle = [dossier('a', 'A', 'b'), dossier('b', 'B', 'a')];
    expect(() => construireArbre(cycle)).not.toThrow();
  });
});

describe('cheminDe', () => {
  it('donne le fil d’Ariane de la racine jusqu’au dossier', () => {
    expect(cheminDe(ARBRE, 'an').map((d) => d.name)).toEqual(['Clients', 'Orange', 'Plans', '2026']);
  });

  it('renvoie un chemin vide pour la racine et pour un inconnu', () => {
    expect(cheminDe(ARBRE, null)).toEqual([]);
    expect(cheminDe(ARBRE, 'inexistant')).toEqual([]);
  });

  it('ne boucle pas sur un cycle', () => {
    const cycle = [dossier('a', 'A', 'b'), dossier('b', 'B', 'a')];
    expect(cheminDe(cycle, 'a').length).toBeLessThanOrEqual(2);
  });
});

describe('descendantsDe', () => {
  it('descend sur toute la branche, pas seulement d’un niveau', () => {
    expect([...descendantsDe(ARBRE, 'clients')].sort()).toEqual(['an', 'orange', 'plans']);
  });

  it('ne compte pas le dossier lui-même', () => {
    expect(descendantsDe(ARBRE, 'clients').has('clients')).toBe(false);
  });

  it('renvoie un ensemble vide pour une feuille', () => {
    expect(descendantsDe(ARBRE, 'an').size).toBe(0);
  });
});

describe('destinationsPossibles', () => {
  it('propose la racine en premier', () => {
    const options = destinationsPossibles(ARBRE);
    expect(options[0]).toEqual({ id: null, chemin: 'Bibliothèque', profondeur: 0 });
  });

  it('libelle chaque dossier par son chemin complet', () => {
    const chemins = destinationsPossibles(ARBRE).map((o) => o.chemin);
    expect(chemins).toContain('Clients / Orange / Plans');
  });

  it('retire le dossier déplacé ET ses descendants', () => {
    // Les y déplacer créerait un cycle, que le serveur refuse. Proposer une
    // action vouée à l'échec est une faute d'interface.
    const ids = destinationsPossibles(ARBRE, 'orange').map((o) => o.id);

    expect(ids).not.toContain('orange');
    expect(ids).not.toContain('plans');
    expect(ids).not.toContain('an');
    expect(ids).toContain('clients');
    expect(ids).toContain('fibre');
    expect(ids).toContain(null);
  });

  it('propose tout sauf la racine quand rien n’est déplacé', () => {
    expect(destinationsPossibles(ARBRE)).toHaveLength(ARBRE.length + 1);
  });
});

describe('nomDeDossier', () => {
  it('nomme la racine « Bibliothèque »', () => {
    expect(nomDeDossier(ARBRE, null)).toBe('Bibliothèque');
  });

  it('le dit quand le dossier a disparu', () => {
    expect(nomDeDossier(ARBRE, 'supprime')).toBe('Dossier introuvable');
  });
});
