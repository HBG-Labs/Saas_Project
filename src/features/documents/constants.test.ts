import { describe, expect, it } from 'vitest';

import { MIGRATION_FILES, readMigration } from '@/test/sql-fixtures';

import {
  TAILLE_MAX_OCTETS,
  TYPES_AUTORISES,
  familleDeDocument,
  estPrevisualisable,
  formaterTaille,
  verifierFichier,
} from './constants';

function fichier(nom: string, type: string, taille: number): File {
  const f = new File(['x'], nom, { type });
  // `File` ne laisse pas fixer `size` par le constructeur sans allouer autant
  // d'octets : 25 Mo de tableau en mémoire pour vérifier une comparaison serait
  // absurde.
  Object.defineProperty(f, 'size', { value: taille });
  return f;
}

/**
 * Le fichier de constantes se présente comme un miroir de la migration.
 *
 * Un miroir que rien ne vérifie finit par mentir : la migration évolue, la
 * constante reste, et l'utilisateur reçoit un refus serveur incompréhensible
 * après avoir attendu la fin d'un envoi. Ce test lit la migration.
 */
describe('constantes en miroir de la migration', () => {
  const sql = readMigration(MIGRATION_FILES.organizationDocuments);

  it('reprend exactement les types MIME autorisés par le bucket', () => {
    const bloc = /allowed_mime_types\)\s*values\s*\([\s\S]*?array\[([\s\S]*?)\]/.exec(sql);
    expect(bloc).not.toBeNull();

    const duBucket = [...bloc![1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]);

    expect(duBucket).toEqual([...TYPES_AUTORISES]);
  });

  it('reprend exactement la taille maximale du bucket', () => {
    expect(sql).toContain(String(TAILLE_MAX_OCTETS));
  });
});

describe('verifierFichier', () => {
  it('refuse un format absent de la liste du bucket', () => {
    const refus = verifierFichier(fichier('script.exe', 'application/x-msdownload', 1024));
    expect(refus?.raison).toBe('type');
  });

  it('refuse un fichier qui dépasse la limite du bucket', () => {
    const refus = verifierFichier(fichier('plan.pdf', 'application/pdf', TAILLE_MAX_OCTETS + 1));
    expect(refus?.raison).toBe('taille');
  });

  it('accepte un fichier exactement à la limite', () => {
    expect(verifierFichier(fichier('plan.pdf', 'application/pdf', TAILLE_MAX_OCTETS))).toBeNull();
  });

  it('juge sur le type MIME, pas sur l’extension', () => {
    // Renommer `virus.exe` en `notice.pdf` ne doit rien changer.
    expect(verifierFichier(fichier('notice.pdf', 'application/x-msdownload', 10))?.raison).toBe(
      'type',
    );
  });
});

describe('familleDeDocument', () => {
  it('classe les types connus', () => {
    expect(familleDeDocument('application/pdf')).toBe('pdf');
    expect(familleDeDocument('image/webp')).toBe('image');
    expect(familleDeDocument('text/csv')).toBe('tableur');
    expect(familleDeDocument('text/plain')).toBe('document');
  });

  it('retombe sur « autre » quand le type manque ou est inconnu', () => {
    expect(familleDeDocument(null)).toBe('autre');
    expect(familleDeDocument('')).toBe('autre');
    expect(familleDeDocument('application/zip')).toBe('autre');
  });

  it('ne prévisualise que ce qui s’affiche sans dépendance', () => {
    expect(estPrevisualisable('application/pdf')).toBe(true);
    expect(estPrevisualisable('image/png')).toBe(true);
    expect(estPrevisualisable('text/csv')).toBe(false);
    expect(estPrevisualisable(null)).toBe(false);
  });
});

describe('formaterTaille', () => {
  it('choisit l’unité lisible', () => {
    expect(formaterTaille(512)).toBe('512 o');
    expect(formaterTaille(2048)).toBe('2 Ko');
    expect(formaterTaille(5 * 1024 * 1024)).toBe('5.0 Mo');
  });

  it('affiche un tiret quand la taille est inconnue', () => {
    expect(formaterTaille(null)).toBe('—');
    expect(formaterTaille(undefined)).toBe('—');
  });
});
