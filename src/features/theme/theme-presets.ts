export type ThemePresetId = 'default' | 'atelier-nuit' | 'contraste-eleve';

/**
 * Les dix ambiances retirees, et vers quoi ramener ceux qui les avaient.
 *
 * ---------------------------------------------------------------------------
 * POURQUOI UNE TABLE PLUTOT QU'UN SIMPLE REPLI
 *
 * Le choix de theme ne vit QUE dans le navigateur : rien en base, donc rien a
 * migrer cote serveur, et aucun droit contractuel touche. Mais laisser le
 * repli generique agir enverrait quelqu'un qui travaillait en sombre vers un
 * theme clair au prochain chargement — un changement brutal, et inexplicable
 * pour lui.
 *
 * Chaque theme retire pointe donc vers l'ambiance signature de SON mode. Le
 * precedent existe dans ce code : la cle historique `nexoratech-theme` est
 * deja migree de cette facon.
 * ---------------------------------------------------------------------------
 */
export const THEMES_RETIRES: Readonly<Record<string, ThemePresetId>> = {
  basic: 'atelier-nuit',
  light: 'default',
  dark: 'atelier-nuit',
  luxury: 'atelier-nuit',
  retro: 'default',
  arctic: 'default',
  nature: 'default',
  ember: 'atelier-nuit',
  dracula: 'atelier-nuit',
  midnight: 'atelier-nuit',
};

export interface ThemePreset {
  id: ThemePresetId;
  label: string;
  description: string;
  baseMode: 'light' | 'dark';
  preview: {
    primary: string;
    surface: string;
    background: string;
  };
  variables: Record<string, string>;
}

/**
 * Thème signature — Atelier Jour.
 *
 * Clair par défaut : REZO360 se lit dehors, en plein jour, souvent à bout de
 * bras. Le mode sombre reste un vrai mode (« Atelier Nuit », ci-dessous), pour
 * le local technique et le travail de nuit — mais ce n'est pas l'apparence de
 * départ.
 *
 * Les variables d'un preset sont posées EN STYLE INLINE sur `<html>` par
 * `ThemeProvider` : elles écrasent `styles/index.css`. Un preset désaccordé
 * avec la feuille de style annule donc silencieusement la palette du produit —
 * raison pour laquelle ces valeurs doivent rester identiques à celles du bloc
 * `:root` de `index.css`.
 */
export const DEFAULT_THEME_PRESET: ThemePreset = {
  id: 'default',
  label: 'Atelier Jour (Défaut)',
  description:
    'Thème signature REZO360 — surfaces lumineuses et encre bleutée, lisible en plein jour',
  baseMode: 'light',
  preview: {
    primary: '#1b44c8',
    surface: '#ffffff',
    background: '#f7f8fa',
  },
  variables: {},
  /*
    VIDE, ET C'EST LE POINT.

    Ces dix-sept variables etaient recopiees ici a l'identique du bloc `:root`
    de `styles/index.css`. Deux sources pour une meme palette, posees en style
    inline sur `<html>`, donc prioritaires sur la feuille : un desaccord
    annulait silencieusement les couleurs du produit — ce fichier le
    documentait lui-meme comme un risque.

    Verifie avant suppression : zero ecart sur les dix-sept. La feuille de
    style redevient la seule source, et le risque disparait au lieu d'etre
    surveille.
  */
};

/**
 * Contrepartie sombre du thème signature.
 *
 * Ses valeurs vivent dans le bloc `.dark` de `styles/index.css`, et nulle part
 * ailleurs : le préréglage n'en pose aucune. La contrainte « garder les deux
 * copies identiques », que ce fichier documentait comme un risque, n'a plus
 * d'objet — il n'y a plus qu'une copie.
 */
export const ATELIER_NUIT_PRESET: ThemePreset = {
  id: 'atelier-nuit',
  label: 'Atelier Nuit',
  description: 'Le thème signature en sombre — local technique et travail de nuit',
  baseMode: 'dark',
  preview: {
    primary: '#7fa0ff',
    surface: '#243150',
    background: '#1c2947',
  },
  variables: {},
  // Vide pour la meme raison : le bloc `.dark` de `styles/index.css` fait foi.
  // Zero ecart constate avant suppression.
};

/**
 * Theme a contraste eleve.
 *
 * Seul des trois a porter des variables : il s'ecarte volontairement de la
 * feuille de style. Aucun gris sous 7:1, bordures portees a la couleur du
 * texte, bleu d'action assombri pour tenir le ratio sur fond blanc.
 *
 * Ce n'est pas une variante esthetique mais une reponse d'accessibilite : en
 * plein soleil sur un chantier, ou pour une vision faible, les nuances
 * intermediaires disparaissent.
 */
export const CONTRASTE_ELEVE_PRESET: ThemePreset = {
  id: 'contraste-eleve',
  label: 'Contraste eleve',
  description: 'Lisibilite maximale — plein soleil, vision faible',
  baseMode: 'light',
  preview: {
    primary: '#0a2e9e',
    surface: '#ffffff',
    background: '#ffffff',
  },
  variables: {
    '--action': '#115c2f',
    '--action-hover': '#0d5129',
    '--action-active': '#094423',
    '--action-foreground': '#ffffff',
    '--action-text': '#084a32',
    '--nav-selected': '#3e478f',
    '--nav-foreground': '#ffffff',
    '--nav-subtle': '#eff0ff',
    '--nav-text': '#2d377b',
    '--workspace-selected': '#25546b',
    '--workspace-foreground': '#ffffff',
    '--settings-selected': '#314055',
    '--settings-foreground': '#ffffff',
    '--quote-marker': '#ffba3f',
    '--quote-marker-foreground': '#543700',
    '--purchase-marker': '#e66976',
    '--purchase-marker-foreground': '#40151d',
    '--background': '#ffffff',
    '--surface': '#ffffff',
    '--surface-raised': '#ffffff',
    '--surface-sunken': '#f2f2f2',
    '--surface-subtle': '#f7f7f7',
    '--surface-hover': '#e8e8e8',
    '--border': '#0f1621',
    '--border-strong': '#000000',
    '--foreground': '#000000',
    '--muted-foreground': '#1f2933',
    '--subtle-foreground': '#2c3742',
    '--primary': '#0a2e9e',
    '--primary-hover': '#08247c',
    '--primary-active': '#061a5c',
    '--primary-foreground': '#ffffff',
    '--primary-subtle': '#e6ebfa',
    '--ring': '#0a2e9e',
  },
};

/**
 * Les trois ambiances retenues.
 *
 * Douze auparavant, dont « Dracula », « Retro » et « Luxury ». Une identite
 * immediatement reconnaissable ne survit pas a douze repeintes : chacune
 * redefinissait la couleur de marque, et rendait impossible toute promesse
 * visuelle sur le produit. Les dix retires sont migres par `THEMES_RETIRES`.
 */
export const THEME_PRESETS: readonly ThemePreset[] = [
  DEFAULT_THEME_PRESET,
  ATELIER_NUIT_PRESET,
  CONTRASTE_ELEVE_PRESET,
];

export const DEFAULT_PRESET_ID: ThemePresetId = 'default';
