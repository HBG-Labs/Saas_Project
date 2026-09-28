import type { CreativeStyleProfile } from '../contracts/style-profile.ts';
import {
  ACCENT_CONTRAST,
  CONTRAST_PAIRS,
  REQUIRED_COLOR_ROLES,
  REQUIRED_EASING_ROLES,
  REQUIRED_MOTIF_ROLES,
  REQUIRED_SPACE_ROLES,
  REQUIRED_STROKE_ROLES,
  REQUIRED_TYPE_ROLES,
  STYLE_ROLE_CONTRACT_VERSION,
} from '../contracts/style-roles.ts';
import { BEHAVIORS } from '../motion/registry.ts';
import type { BehaviorRegistry } from '../motion/registry.ts';
import { contrastRatio } from '../style/contrast.ts';
import { IssueCollector } from './issues.ts';
import type { ValidationIssue } from './issues.ts';

function roleKey(ref: string): string {
  return ref.slice(ref.indexOf('.') + 1);
}

export function validateStyleSemantics(style: CreativeStyleProfile, prefix = '', registry: BehaviorRegistry = BEHAVIORS): ValidationIssue[] {
  const c = new IssueCollector();
  const at = (path: string) => (prefix ? `${prefix}.${path}` : path);

  if (style.role_contract !== STYLE_ROLE_CONTRACT_VERSION) {
    c.error('style.role_contract', at('role_contract'), `contrat de rôles ${style.role_contract} non pris en charge (attendu ${STYLE_ROLE_CONTRACT_VERSION})`);
  }

  const requireRoles = (table: Record<string, unknown>, roles: readonly string[], section: string) => {
    for (const role of roles) {
      if (!Object.prototype.hasOwnProperty.call(table, role)) {
        c.error('style.missing_role', at(section), `rôle requis « ${role} » absent`);
      }
    }
  };
  requireRoles(style.palette, REQUIRED_COLOR_ROLES, 'palette');
  requireRoles(style.typography.scale, REQUIRED_TYPE_ROLES, 'typography.scale');
  requireRoles(style.motion_personality.easings, REQUIRED_EASING_ROLES, 'motion_personality.easings');
  requireRoles(style.strokes, REQUIRED_STROKE_ROLES, 'strokes');
  requireRoles(style.space, REQUIRED_SPACE_ROLES, 'space');
  requireRoles(style.motifs, REQUIRED_MOTIF_ROLES, 'motifs');

  for (const [key, typeStyle] of Object.entries(style.typography.scale)) {
    const family = style.typography.families[typeStyle.family];
    const path = at(`typography.scale.${key}`);
    if (!family) {
      c.error('type.unknown_family', path, `famille « ${typeStyle.family} » absente`);
    } else if (!family.files.some((f) => f.weight === typeStyle.weight && f.style === 'normal')) {
      c.error('type.missing_weight', path, `aucun fichier ${typeStyle.family} en graisse ${typeStyle.weight}`);
    }
  }

  for (const [key, motif] of Object.entries(style.motifs)) {
    if (!style.strokes[motif.weight]) c.error('motif.unknown_stroke', at(`motifs.${key}.weight`), `trait « ${motif.weight} » absent`);
  }

  const colorRef = (ref: string | null, path: string) => {
    if (ref !== null && !style.palette[roleKey(ref)]) c.error('token.unknown', at(path), `couleur « ${ref} » absente de la palette`);
  };
  const sub = style.subtitle_style;
  if (!style.typography.scale[roleKey(sub.type)]) {
    c.error('token.unknown', at('subtitle_style.type'), `style typographique « ${sub.type} » absent`);
  }
  colorRef(sub.color, 'subtitle_style.color');
  colorRef(sub.backdrop, 'subtitle_style.backdrop');
  if (style.image_treatment.duotone) {
    colorRef(style.image_treatment.duotone.dark, 'image_treatment.duotone.dark');
    colorRef(style.image_treatment.duotone.light, 'image_treatment.duotone.light');
  }
  if (style.image_treatment.grade === 'duotone' && !style.image_treatment.duotone) {
    c.error('image.duotone_missing', at('image_treatment.duotone'), 'un traitement duotone exige ses deux couleurs');
  }
  const grade = style.image_treatment.grade;
  if ((grade === 'warm' || grade === 'cool' || grade === 'duotone') && !style.image_treatment.tint) {
    c.error('image.tint_missing', at('image_treatment.tint'), `l'étalonnage « ${grade} » exige un voile déclaré (couleur et opacité)`);
  }
  if (style.image_treatment.tint) colorRef(style.image_treatment.tint.color, 'image_treatment.tint.color');
  style.illustration_treatment.palette_roles.forEach((ref, i) => colorRef(ref, `illustration_treatment.palette_roles[${i}]`));

  for (const [kind, cue] of Object.entries(style.sound_personality.event_cues)) {
    if (cue && !style.sound_personality.cues[cue]) {
      c.error('sound.unknown_cue', at(`sound_personality.event_cues.${kind}`), `cue « ${cue} » non défini`);
    }
  }

  // Le registre fermé est la source de vérité : un style ne peut nommer
  // (autoriser, interdire, préférer, éviter) qu'un comportement qui existe.
  // Une intention future (« jamais de glitch ») s'exprime par un style_tag.
  const known = new Set(registry.ids());
  const orphan = (id: string, where: string) => {
    if (!known.has(id)) c.error('style.behavior_unknown', at(where), `${id} n'existe pas dans le registre des comportements ${registry.version}`);
    return !known.has(id);
  };
  for (const [id, policy] of Object.entries(style.motion_personality.behaviors)) {
    const where = `motion_personality.behaviors.${id}`;
    if (orphan(id, where)) continue;
    const definitions = registry.versions(id).map((v) => registry.get(id, v)!);
    for (const variant of policy.variants ?? []) {
      if (!definitions.some((d) => variant in d.variants)) {
        c.error('style.behavior_variant_unknown', at(`${where}.variants`), `variante « ${variant} » inconnue de ${id}`);
      }
    }
    for (const param of Object.keys(policy.param_bounds ?? {})) {
      if (!definitions.some((d) => param in d.parameters_schema)) {
        c.error('style.behavior_param_unknown', at(`${where}.param_bounds.${param}`), `paramètre « ${param} » inconnu de ${id}`);
      }
    }
  }
  style.forbidden.behaviors.forEach((id, i) => orphan(id, `forbidden.behaviors[${i}]`));
  for (const list of ['preferred', 'avoid'] as const) {
    style.transition_preferences[list].forEach((id, i) => {
      const where = `transition_preferences.${list}[${i}]`;
      if (orphan(id, where)) return;
      const latest = registry.get(id, registry.versions(id).at(-1)!)!;
      if (latest.scope !== 'transition') c.error('style.transition_not_transition', at(where), `${id} n'est pas une transition`);
    });
  }

  const forbidden = new Set(style.forbidden.behaviors);
  for (const id of forbidden) {
    if (style.motion_personality.behaviors[id]?.allowed) {
      c.error('behavior.contradiction', at(`motion_personality.behaviors.${id}`), `${id} est à la fois autorisé et interdit`);
    }
  }
  const prefs = style.transition_preferences;
  for (const id of prefs.preferred) {
    if (forbidden.has(id)) c.error('transition.forbidden', at('transition_preferences.preferred'), `${id} préféré mais interdit`);
    if (prefs.avoid.includes(id)) c.error('transition.contradiction', at('transition_preferences'), `${id} à la fois préféré et évité`);
  }

  // Personnalité de mouvement : cohérence interne, sans valeur imposée.
  const mp = style.motion_personality;
  if (mp.amplitude.accent_scale - 1 > mp.max_overshoot + 1e-9) {
    c.error('motion.accent_scale', at('motion_personality.amplitude.accent_scale'), `échelle d'accent ${mp.amplitude.accent_scale} au-delà du dépassement autorisé (${mp.max_overshoot})`);
  }
  for (const name of ['enter_travel', 'exit_travel'] as const) {
    if (style.space[mp.amplitude[name]] === undefined) {
      c.error('motion.amplitude_unknown', at(`motion_personality.amplitude.${name}`), `espacement « ${mp.amplitude[name]} » absent`);
    }
  }
  const hold = mp.timing.hold;
  if (!(hold.min_beats <= hold.preferred_beats && hold.preferred_beats <= hold.max_beats)) {
    c.error('motion.hold_range', at('motion_personality.timing.hold'), 'la pause doit vérifier min ≤ préférée ≤ max');
  }

  const { width, height } = style.reference_canvas;
  const m = style.grid.margin;
  if (m.left + m.right >= width || m.top + m.bottom >= height) {
    c.error('grid.margins', at('grid.margin'), 'les marges ne laissent aucune zone utile');
  } else if (style.grid.gutter * (style.grid.columns - 1) >= width - m.left - m.right) {
    c.error('grid.gutter', at('grid.gutter'), 'les gouttières dépassent la largeur utile');
  }

  // Lisibilité : garde-fou valable pour un style écrit comme pour un style généré.
  for (const pair of CONTRAST_PAIRS) {
    const text = style.palette[pair.text];
    const surface = style.palette[pair.surface];
    if (text && surface && contrastRatio(text, surface) < pair.min) {
      c.error(
        'style.contrast',
        at('palette'),
        `${pair.text} sur ${pair.surface} : ${contrastRatio(text, surface).toFixed(2)} < ${pair.min}`,
      );
    }
  }
  const accent = style.palette[ACCENT_CONTRAST.text];
  const surface = style.palette[ACCENT_CONTRAST.surface];
  if (accent && surface && contrastRatio(accent, surface) < ACCENT_CONTRAST.min) {
    c.warn(
      'style.accent_contrast',
      at('palette.accent'),
      `accent sur surface principale : ${contrastRatio(accent, surface).toFixed(2)} < ${ACCENT_CONTRAST.min}`,
    );
  }

  return c.issues;
}
