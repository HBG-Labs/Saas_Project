/**
 * Les moteurs candidats du benchmark — chacun est une fonction
 * `(fichier, options) → { texte, segments?, duree?, brut }`.
 *
 * VÉRIFIÉ LE 21/09/2026 dans la documentation OpenAI (guide « speech-to-text »
 * et référence `POST /v1/audio/transcriptions`) :
 *   - `gpt-4o-transcribe`, `gpt-4o-mini-transcribe` : `language`, `prompt`,
 *     `response_format: json`.
 *   - `gpt-transcribe` : recommandé par le guide ; `languages` (pluriel)
 *     remplace `language` — « ne pas envoyer les deux » ; `prompt` accepté.
 *     La référence de l'API ne le liste pas encore parmi les valeurs de
 *     `model` : le benchmark l'appelle et CONSIGNE le refus s'il y en a un,
 *     plutôt que de le supposer disponible.
 *   - `whisper-1` : `language`, `prompt` (224 tokens), `verbose_json` avec
 *     `duration` et `segments` ; pas de streaming.
 *   - `gpt-4o-transcribe-diarize` : PAS de `prompt` ; `response_format:
 *     diarized_json` (segments start/end/speaker/text) ; `chunking_strategy:
 *     auto` au-delà de 30 s.
 *
 * Les prix sont ceux de la page tarifs à la même date, par minute d'audio.
 */

export const PRIX_PAR_MINUTE_USD = {
  'gpt-4o-transcribe': 0.006,
  'gpt-4o-mini-transcribe': 0.003,
  'gpt-transcribe': 0.0045,
  'whisper-1': 0.006,
  'gpt-4o-transcribe-diarize': 0.006,
};

/** Un modèle de refus définitif (modèle inconnu, fichier illisible) vs une panne. */
export class MoteurRefus extends Error {
  constructor(message, statut) {
    super(message);
    this.name = 'MoteurRefus';
    this.statut = statut;
  }
}

async function appelTranscription({ apiKey, fetchImpl, fichier, champs }) {
  const form = new FormData();
  form.append('file', fichier.blob, fichier.nom);
  for (const [cle, valeur] of Object.entries(champs)) {
    if (valeur === undefined || valeur === null) continue;
    if (Array.isArray(valeur)) {
      for (const v of valeur) form.append(`${cle}[]`, String(v));
    } else {
      form.append(cle, String(valeur));
    }
  }
  const debut = performance.now();
  const reponse = await fetchImpl('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const latence_ms = Math.round(performance.now() - debut);
  const corps = await reponse.text();
  if (!reponse.ok) {
    const message = `HTTP ${reponse.status} : ${corps.slice(0, 300)}`;
    if (reponse.status >= 400 && reponse.status < 500 && reponse.status !== 429) {
      throw new MoteurRefus(message, reponse.status);
    }
    throw new Error(message);
  }
  let json;
  try {
    json = JSON.parse(corps);
  } catch {
    json = { text: corps };
  }
  return { json, latence_ms };
}

function segmentsDe(json) {
  if (!Array.isArray(json.segments)) return undefined;
  return json.segments.map((s) => ({
    start: typeof s.start === 'number' ? s.start : null,
    end: typeof s.end === 'number' ? s.end : null,
    speaker: typeof s.speaker === 'string' ? s.speaker : null,
    text: typeof s.text === 'string' ? s.text.trim() : '',
  }));
}

/**
 * Le catalogue. `glossaire` n'est transmis qu'aux moteurs qui acceptent un
 * prompt ; `prompt` est la phrase de contexte construite par le script.
 */
export const MOTEURS = {
  actuel: {
    libelle: 'gpt-4o-transcribe (actuel)',
    modele: 'gpt-4o-transcribe',
    glossaire: false,
    champs: () => ({ model: 'gpt-4o-transcribe', language: 'fr', response_format: 'json' }),
  },
  'gpt-transcribe': {
    libelle: 'gpt-transcribe',
    modele: 'gpt-transcribe',
    glossaire: false,
    champs: () => ({ model: 'gpt-transcribe', languages: ['fr'], response_format: 'json' }),
  },
  'gpt-transcribe+glossaire': {
    libelle: 'gpt-transcribe + glossaire',
    modele: 'gpt-transcribe',
    glossaire: true,
    champs: ({ prompt }) => ({
      model: 'gpt-transcribe',
      languages: ['fr'],
      response_format: 'json',
      prompt,
    }),
  },
  'gpt-4o-transcribe+glossaire': {
    libelle: 'gpt-4o-transcribe + glossaire',
    modele: 'gpt-4o-transcribe',
    glossaire: true,
    champs: ({ prompt }) => ({
      model: 'gpt-4o-transcribe',
      language: 'fr',
      response_format: 'json',
      prompt,
    }),
  },
  'gpt-4o-mini-transcribe': {
    libelle: 'gpt-4o-mini-transcribe',
    modele: 'gpt-4o-mini-transcribe',
    glossaire: false,
    champs: () => ({ model: 'gpt-4o-mini-transcribe', language: 'fr', response_format: 'json' }),
  },
  'whisper-1': {
    libelle: 'whisper-1',
    modele: 'whisper-1',
    glossaire: false,
    champs: () => ({ model: 'whisper-1', language: 'fr', response_format: 'verbose_json' }),
  },
  diarize: {
    libelle: 'gpt-4o-transcribe-diarize',
    modele: 'gpt-4o-transcribe-diarize',
    glossaire: false,
    champs: () => ({
      model: 'gpt-4o-transcribe-diarize',
      response_format: 'diarized_json',
      chunking_strategy: 'auto',
    }),
  },
};

/** Les moteurs lancés par défaut — ceux de l'arbitrage. */
export const MOTEURS_PAR_DEFAUT = [
  'actuel',
  'gpt-transcribe',
  'gpt-transcribe+glossaire',
  'whisper-1',
  'diarize',
];

/**
 * Le prompt de contexte : une phrase courte, puis les termes. Court parce
 * que Whisper s'arrête à 224 tokens et que le guide demande du contexte
 * « non structuré ». Aucune donnée réelle d'organisation ici — le benchmark
 * teste le principe, pas le dictionnaire.
 */
export function construirePrompt(glossaire) {
  const termes = [...new Set((glossaire ?? []).map((t) => String(t).trim()).filter(Boolean))];
  if (termes.length === 0) return undefined;
  return `Enregistrement de terrain d'une entreprise de services techniques (fibre, électricité, plomberie, climatisation, BTP), en français. Termes et noms qui peuvent apparaître : ${termes.join(', ')}.`;
}

/** Lance un moteur sur un fichier. Rend texte, segments, durée, latence, brut. */
export async function transcrire(cle, fichier, { apiKey, fetchImpl = fetch, prompt }) {
  const moteur = MOTEURS[cle];
  if (!moteur) throw new Error(`Moteur inconnu : ${cle}`);
  const champs = moteur.champs({ prompt: moteur.glossaire ? prompt : undefined });
  const { json, latence_ms } = await appelTranscription({ apiKey, fetchImpl, fichier, champs });
  const segments = segmentsDe(json);
  const texte =
    typeof json.text === 'string' && json.text.trim().length > 0
      ? json.text.trim()
      : (segments ?? [])
          .map((s) => s.text)
          .join(' ')
          .trim();
  return {
    texte,
    segments,
    duree_s: typeof json.duration === 'number' ? json.duration : undefined,
    latence_ms,
    modele: moteur.modele,
    glossaire: moteur.glossaire,
    brut: json,
  };
}
