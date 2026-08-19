import { beforeAll, describe, expect, it } from 'vitest';

import { DEFAULT_AI_SUGGESTIONS, sendAiQuery, type AiQueryResult } from './ai.service';

/**
 * Sans Edge Function `ai-assistant` déployée, `sendAiQuery` répond en mode
 * dégradé. Ces tests verrouillent ce que ce mode a le droit de dire.
 *
 * Ils remplacent une série qui affirmait le contraire : elle exigeait la
 * présence de réponses chiffrées (« 2 interventions ont dépassé leur date
 * prévue », « 92 % ») que rien n'avait lues, attribuées à « Base de données
 * PostgreSQL ». Le test gravait le défaut dans la suite.
 */

/** Une quantité collée à un objet métier : la forme exacte de ce qu'on interdit. */
const AFFIRMATION_CHIFFREE =
  /\d+\s*(interventions?|missions?|rapports?|comptes?-rendus?|équipements?|matériels?|véhicules?|articles?)/i;
const POURCENTAGE = /\d+\s*%/;

const REQUETES = [
  ...DEFAULT_AI_SUGGESTIONS.map((s) => s.prompt),
  'Quelles interventions sont en retard ?',
  'Quel est l’état du stock et du matériel ?',
  'Résume-moi la semaine',
  'Prépare un compte-rendu pour cette intervention',
  'Une question sans rapport avec quoi que ce soit',
];

// Chaque réponse coûte 600 ms de latence simulée. Résolues en parallèle une
// seule fois, les neuf tiennent dans une seconde ; enchaînées test par test,
// elles dépassaient le délai d'attente de Vitest.
const reponses = new Map<string, AiQueryResult>();

beforeAll(async () => {
  const resultats = await Promise.all(
    REQUETES.map((query) => sendAiQuery({ organizationId: 'org-test', query, history: [] })),
  );
  REQUETES.forEach((query, i) => {
    reponses.set(query, resultats[i]!);
  });
});

describe('ai.service — suggestions', () => {
  it('fournit des suggestions prédéfinies pertinentes', () => {
    expect(DEFAULT_AI_SUGGESTIONS.length).toBeGreaterThanOrEqual(4);
    const categories = DEFAULT_AI_SUGGESTIONS.map((s) => s.category);
    expect(categories).toContain('interventions');
    expect(categories).toContain('stock');
    expect(categories).toContain('planning');
    expect(categories).toContain('reports');
  });
});

describe('ai.service — le mode dégradé n’invente rien', () => {
  it.each(REQUETES)('n’affirme aucun chiffre métier pour « %s »', (query) => {
    const result = reponses.get(query)!;

    expect(result.degraded).toBe(true);
    expect(result.content).not.toMatch(AFFIRMATION_CHIFFREE);
    expect(result.content).not.toMatch(POURCENTAGE);
  });

  it.each(REQUETES)('ne s’attribue aucune source pour « %s »', (query) => {
    // Citer « Base de données PostgreSQL » sans l'avoir interrogée est le
    // mensonge le plus coûteux : il rend le chiffre crédible.
    expect(reponses.get(query)!.sources).toBeUndefined();
  });

  it.each(REQUETES)('annonce sa limite pour « %s »', (query) => {
    expect(reponses.get(query)!.content.toLowerCase()).toMatch(
      /pas encore|ne peux pas|générique|n’y ai pas accès/,
    );
  });

  it('ne demande jamais confirmation : aucune action dégradée ne modifie quoi que ce soit', () => {
    // `requiresConfirmation: true` sur une action qui se contente de naviguer
    // dramatisait un simple changement de page, et laissait croire qu'un
    // brouillon allait être créé.
    for (const query of REQUETES) {
      for (const action of reponses.get(query)!.actions ?? []) {
        expect(action.requiresConfirmation).toBe(false);
      }
    }
  });
});

describe('ai.service — ce que le mode dégradé sait faire', () => {
  it('oriente vers la file de contrôle quand on parle de retard', () => {
    const result = reponses.get('Quelles interventions sont en retard ?')!;
    expect(result.actions?.map((a) => a.actionType)).toContain('view_late_interventions');
  });

  it('oriente vers le parc matériel quand on parle d’outillage', () => {
    const result = reponses.get('Quel est l’état du stock et du matériel ?')!;
    expect(result.actions?.map((a) => a.actionType)).toContain('check_equipment_alerts');
  });

  it('propose une trame de compte-rendu, en la disant générique', () => {
    const result = reponses.get('Prépare un compte-rendu pour cette intervention')!;
    expect(result.content).toContain('Trame de compte-rendu');
    expect(result.content).toContain('générique');
  });
});
