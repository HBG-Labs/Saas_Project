import { describe, expect, it } from 'vitest';

import { ACCENT_COLORS, ACCENTS_RETIRES, type AccentColor } from './accent-colors';

/**
 * Les garanties d'accessibilité de la palette d'accent.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CES TESTS EXISTENT
 *
 * Le jeu précédent allait du vert au rose. Mesuré, il laissait passer QUATRE
 * combinaisons sous le seuil de 4,5:1 — Vert 3,30:1 et Ambre 3,19:1 en clair,
 * Cyan 3,68:1 en clair, Cobalt 3,68:1 en sombre. Rien ne le signalait : une
 * couleur d'accent n'est qu'un objet de données, et personne ne vérifie un
 * objet de données à l'œil.
 *
 * Ces tests rendent la faute impossible à réintroduire en silence : la prochaine
 * nuance ajoutée devra passer les mêmes seuils que les neuf actuelles.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Luminance relative, WCAG 2.1 § dfn-relative-luminance. */
function luminance(hex: string): number {
  const canal = (paire: string) => {
    const v = parseInt(paire, 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const corps = hex.replace('#', '');
  return (
    0.2126 * canal(corps.slice(0, 2)) +
    0.7152 * canal(corps.slice(2, 4)) +
    0.0722 * canal(corps.slice(4, 6))
  );
}

function contraste(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const haut = Math.max(la, lb);
  const bas = Math.min(la, lb);
  return (haut + 0.05) / (bas + 0.05);
}

/**
 * Lit une variable du jeu, et échoue si elle manque.
 *
 * Retourner une chaîne vide rendrait le contraste calculable mais faux : le test
 * passerait en mesurant du noir. Une absence doit casser, pas s'arrondir.
 */
function variable(jeu: Record<string, string>, cle: string): string {
  const valeur = jeu[cle];
  expect(valeur, `variable ${cle} absente`).toBeTypeOf('string');
  return valeur ?? '';
}

/** Les six variables qu'une nuance a le droit de surcharger, et elles seules. */
const VARIABLES_AUTORISEES = [
  '--primary',
  '--primary-hover',
  '--primary-active',
  '--primary-foreground',
  '--primary-subtle',
  '--ring',
] as const;

const JEUX = [
  'lightVariables',
  'darkVariables',
  'contrastVariables',
] as const satisfies readonly (keyof AccentColor)[];

/** Les nuances hors `auto` : `auto` ne déclare rien, elle laisse le preset. */
const NUANCES = ACCENT_COLORS.filter((a) => a.isAuto !== true);

describe('palette d’accent', () => {
  it('offre neuf options, aux identifiants distincts', () => {
    expect(ACCENT_COLORS).toHaveLength(9);
    expect(new Set(ACCENT_COLORS.map((a) => a.id)).size).toBe(9);
    expect(ACCENT_COLORS.filter((a) => a.isAuto === true)).toHaveLength(1);
  });

  it('laisse « auto » servir le bleu REZO de la feuille de styles', () => {
    // `auto` ne doit RIEN poser : c'est ce qui garantit qu'une personne qui n'a
    // jamais touché au réglage voit exactement le bleu de la marque.
    const auto = ACCENT_COLORS.find((a) => a.isAuto === true);
    expect(auto?.lightVariables).toEqual({});
    expect(auto?.darkVariables).toEqual({});
    expect(auto?.contrastVariables).toEqual({});
    expect(auto?.hex).toBe('#1b44c8');
  });

  it.each(NUANCES.map((n) => [n.label, n] as const))(
    '%s décrit les trois thèmes, et rien que les variables d’accent',
    (_label, nuance) => {
      for (const jeu of JEUX) {
        const cles = Object.keys(nuance[jeu]).sort();
        /*
          Condition 6 de l'arbitrage : succès, avertissement, erreur et
          information ne bougent pas. Une couleur qui porte un sens ne se
          personnalise pas — la seule façon de le garantir est d'interdire la
          clé, pas de faire confiance à la relecture.
        */
        expect(cles).toEqual([...VARIABLES_AUTORISEES].sort());
      }
    },
  );

  it.each(NUANCES.map((n) => [n.label, n] as const))(
    '%s reste lisible sur les trois thèmes',
    (_label, nuance) => {
      for (const jeu of JEUX) {
        const v = nuance[jeu];
        const texte = variable(v, '--primary-foreground');

        for (const etape of ['--primary', '--primary-hover', '--primary-active'] as const) {
          expect(
            contraste(variable(v, etape), texte),
            `${nuance.id}/${jeu}/${etape} contre son texte`,
          ).toBeGreaterThanOrEqual(4.5);
        }

        // La pastille : le texte y prend la couleur d'accent sur le fond discret.
        expect(
          contraste(variable(v, '--primary'), variable(v, '--primary-subtle')),
          `${nuance.id}/${jeu} pastille`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it('ne laisse aucune nuance affaiblir « Contraste élevé »', () => {
    // Le preset tient 11,07:1 contre blanc. Une nuance qui redescendrait au
    // seuil ordinaire viderait le thème d'accessibilité de sa raison d'être.
    for (const nuance of NUANCES) {
      const v = nuance.contrastVariables;
      expect(
        contraste(variable(v, '--primary'), variable(v, '--primary-foreground')),
        `${nuance.id} en contraste élevé`,
      ).toBeGreaterThanOrEqual(7);
    }
  });

  it('garde les neuf nuances à poids égal', () => {
    /*
      L'invariant de l'arbitrage : « une personnalisation subtile, pas neuf
      interfaces visuellement différentes ». Les nuances varient en teinte, pas
      en luminosité — sinon l'une d'elles rendrait les boutons nettement plus
      lourds ou plus légers que les autres, et la densité de l'écran changerait
      avec le réglage.
    */
    const bleuRezo = 7.76;
    for (const nuance of NUANCES) {
      const mesure = contraste(variable(nuance.lightVariables, '--primary'), '#ffffff');
      expect(
        Math.abs(mesure - bleuRezo),
        `${nuance.id} s’écarte du poids du bleu REZO`,
      ).toBeLessThan(0.1);
    }
  });
});

describe('migration des accents retirés', () => {
  const ANCIENS = ['navy', 'blue', 'purple', 'green', 'red', 'amber', 'pink', 'cyan'];

  it('couvre les huit accents retirés', () => {
    expect(Object.keys(ACCENTS_RETIRES).sort()).toEqual([...ANCIENS].sort());
  });

  it('ne renvoie que vers des nuances existantes', () => {
    const connues = new Set(ACCENT_COLORS.map((a) => a.id));
    for (const [ancien, nouvelle] of Object.entries(ACCENTS_RETIRES)) {
      expect(connues.has(nouvelle), `${ancien} → ${nouvelle}`).toBe(true);
    }
  });

  it('donne à chaque ancien accent une nuance distincte', () => {
    // Faire converger deux anciens choix sur la même nuance reviendrait à
    // effacer une préférence : deux personnes réglées différemment verraient
    // soudain la même chose.
    const cibles = Object.values(ACCENTS_RETIRES);
    expect(new Set(cibles).size).toBe(cibles.length);
  });

  it('ne renvoie jamais vers « auto »', () => {
    // Renvoyer vers `auto`, c'est précisément la remise à zéro que la table
    // existe pour éviter.
    expect(Object.values(ACCENTS_RETIRES)).not.toContain('auto');
  });
});
