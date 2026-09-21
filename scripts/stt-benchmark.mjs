#!/usr/bin/env node
/**
 * Benchmark de la reconnaissance vocale — phase 1 du chantier « transcription ».
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI UN BENCHMARK AVANT DE CHANGER DE MOTEUR
 *
 * Aucun enregistrement réel n'a encore été transcrit par REZO360 : on ne sait
 * pas si le moteur en place est mauvais, ni sur quoi. Ce script établit la
 * comparaison, sur les MÊMES audios, entre le moteur actuel et les candidats,
 * et rend un rapport qui peut donner tort au nouveau moteur — c'est le but.
 *
 * LE CORPUS
 *
 *   benchmark/stt/<nom>.webm|m4a|mp3|mp4|wav      l'audio (JAMAIS versionné)
 *   benchmark/stt/<nom>.txt                        la transcription de référence, à la main
 *   benchmark/stt/<nom>.meta.json                  facultatif : { "termes": [], "noms": [],
 *                                                  "references": [], "nombres": [], "tags": {} }
 *   benchmark/stt-glossaire-pilote.json            le glossaire du test « + glossaire » (versionné,
 *                                                  aucune donnée réelle)
 *
 * Le script tourne avec les clips présents, un seul suffit. Les résultats
 * (transcriptions, JSON, rapport) vont dans benchmark/stt/out/<horodatage>/,
 * gitignoré comme le corpus. Un appel déjà fait n'est pas refait (cache par
 * clip × moteur × empreinte du prompt) ; `--force` pour recommencer.
 *
 * USAGE
 *
 *   OPENAI_API_KEY=sk-... node scripts/stt-benchmark.mjs
 *   node scripts/stt-benchmark.mjs --moteurs actuel,gpt-transcribe --clips calme-01,bruit-03
 *   node scripts/stt-benchmark.mjs --simulation        # sans réseau : moteurs factices, pour vérifier l'outillage
 *   node scripts/stt-benchmark.mjs --force              # ignore le cache
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

import { mesurer, nomsPropresDe, normaliser } from './stt-benchmark/metriques.mjs';
import {
  MOTEURS,
  MOTEURS_PAR_DEFAUT,
  MoteurRefus,
  PRIX_PAR_MINUTE_USD,
  construirePrompt,
  transcrire,
} from './stt-benchmark/moteurs.mjs';
import { construireRapport } from './stt-benchmark/rapport.mjs';

const DOSSIER = 'benchmark/stt';
const GLOSSAIRE = 'benchmark/stt-glossaire-pilote.json';
const EXTENSIONS = {
  '.webm': 'audio/webm',
  '.m4a': 'audio/mp4',
  '.mp4': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.mpga': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mpeg': 'audio/mpeg',
};

function arguments_() {
  const args = process.argv.slice(2);
  const opt = {
    moteurs: MOTEURS_PAR_DEFAUT,
    clips: null,
    force: false,
    simulation: false,
    dossier: DOSSIER,
  };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--moteurs')
      opt.moteurs = args[++i]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    else if (a === '--clips')
      opt.clips = args[++i]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    else if (a === '--force') opt.force = true;
    else if (a === '--simulation') opt.simulation = true;
    else if (a === '--dossier') opt.dossier = args[++i];
    else if (a === '--help' || a === '-h') {
      console.log(
        'Usage : node scripts/stt-benchmark.mjs [--moteurs a,b] [--clips x,y] [--force] [--simulation] [--dossier chemin]',
      );
      console.log(`Moteurs : ${Object.keys(MOTEURS).join(', ')}`);
      process.exit(0);
    }
  }
  for (const m of opt.moteurs)
    if (!MOTEURS[m]) {
      console.error(`Moteur inconnu : ${m}. Connus : ${Object.keys(MOTEURS).join(', ')}`);
      process.exit(2);
    }
  return opt;
}

/** Durée d'un WAV PCM depuis son en-tête ; `null` pour les autres formats. */
export function dureeWav(buffer) {
  if (
    buffer.length < 44 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WAVE'
  )
    return null;
  let offset = 12;
  let byteRate = null;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const taille = buffer.readUInt32LE(offset + 4);
    if (id === 'fmt ') byteRate = buffer.readUInt32LE(offset + 16);
    if (id === 'data' && byteRate) return taille / byteRate;
    offset += 8 + taille + (taille % 2);
  }
  return null;
}

export function lireCorpus(dossier, filtre) {
  if (!existsSync(dossier)) return [];
  const clips = [];
  for (const nom of readdirSync(dossier).sort()) {
    const ext = extname(nom).toLowerCase();
    if (!EXTENSIONS[ext]) continue;
    const base = basename(nom, ext);
    if (filtre && !filtre.includes(base)) continue;
    const ref = join(dossier, `${base}.txt`);
    if (!existsSync(ref)) {
      console.warn(`  ! ${nom} : pas de ${base}.txt — clip ignoré`);
      continue;
    }
    const metaChemin = join(dossier, `${base}.meta.json`);
    const meta = existsSync(metaChemin) ? JSON.parse(readFileSync(metaChemin, 'utf8')) : {};
    const buffer = readFileSync(join(dossier, nom));
    clips.push({
      nom: base,
      fichier: nom,
      chemin: join(dossier, nom),
      mime: EXTENSIONS[ext],
      taille: buffer.length,
      reference: readFileSync(ref, 'utf8').trim(),
      meta,
      duree_s: typeof meta.duree_s === 'number' ? meta.duree_s : dureeWav(buffer),
      buffer,
    });
  }
  return clips;
}

/** Un moteur factice : la référence, dégradée de façon déterministe — pour tester l'outillage sans réseau. */
function transcrireSimule(cle, clip, prompt) {
  const mots = clip.reference.split(/\s+/);
  const graine = createHash('md5')
    .update(cle + clip.nom)
    .digest()[0];
  const sortie = mots
    .map((m, i) => {
      if ((i * 7 + graine) % 11 === 0) return m.replace(/[aeiou]/, 'o'); // une substitution
      if ((i * 5 + graine) % 23 === 0) return ''; // une suppression
      return m;
    })
    .filter(Boolean);
  // Le glossaire « aide » : les termes du prompt reviennent intacts.
  let texte = sortie.join(' ');
  if (prompt)
    for (const t of clip.meta.termes ?? [])
      if (!normaliser(texte).includes(normaliser(t))) texte += ` ${t}`;
  return {
    texte,
    segments: undefined,
    duree_s: clip.duree_s ?? 30,
    latence_ms: 100 + graine,
    modele: `simule:${cle}`,
    glossaire: Boolean(prompt),
    brut: {},
  };
}

async function main() {
  const opt = arguments_();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!opt.simulation && !apiKey) {
    console.error(
      "OPENAI_API_KEY absente. Posez-la dans l'environnement (jamais dans le dépôt), ou lancez --simulation.",
    );
    process.exit(2);
  }
  const clips = lireCorpus(opt.dossier, opt.clips);
  if (clips.length === 0) {
    console.error(
      `Aucun clip dans ${opt.dossier}/ — lisez benchmark/README-STT.md pour enregistrer les vôtres.`,
    );
    process.exit(1);
  }
  const glossaire = existsSync(GLOSSAIRE) ? JSON.parse(readFileSync(GLOSSAIRE, 'utf8')) : [];
  const termesGlossaire = Array.isArray(glossaire) ? glossaire : Object.values(glossaire).flat();
  const prompt = construirePrompt(termesGlossaire);
  const empreintePrompt = createHash('md5')
    .update(prompt ?? '')
    .digest('hex')
    .slice(0, 8);

  const horodatage = new Date().toISOString().replace(/[:.]/g, '-');
  const sortie = join(opt.dossier, 'out', horodatage);
  const cache = join(opt.dossier, 'out', 'cache');
  mkdirSync(sortie, { recursive: true });
  mkdirSync(cache, { recursive: true });

  console.log(
    `${String(clips.length)} clip(s), ${String(opt.moteurs.length)} moteur(s)${opt.simulation ? ' — SIMULATION' : ''}`,
  );
  console.log(`Glossaire : ${String(termesGlossaire.length)} terme(s) (${GLOSSAIRE})`);

  const resultats = [];
  for (const clip of clips) {
    const termes =
      clip.meta.termes ??
      termesGlossaire.filter((t) => normaliser(clip.reference).includes(normaliser(t)));
    const noms = clip.meta.noms ?? nomsPropresDe(clip.reference);
    console.log(
      `\n▶ ${clip.nom} (${(clip.taille / 1024).toFixed(0)} Ko${clip.duree_s ? `, ${clip.duree_s.toFixed(0)} s` : ''}) — ${String(termes.length)} terme(s) attendu(s), ${String(noms.length)} nom(s)`,
    );
    for (const cle of opt.moteurs) {
      const moteur = MOTEURS[cle];
      const cacheFichier = join(
        cache,
        `${clip.nom}.${cle}.${moteur.glossaire ? empreintePrompt : 'sans'}.json`,
      );
      let res;
      if (!opt.force && !opt.simulation && existsSync(cacheFichier)) {
        res = JSON.parse(readFileSync(cacheFichier, 'utf8'));
        process.stdout.write(`  ${moteur.libelle.padEnd(32)} (cache) `);
      } else {
        process.stdout.write(`  ${moteur.libelle.padEnd(32)} … `);
        try {
          res = opt.simulation
            ? transcrireSimule(cle, clip, moteur.glossaire ? prompt : undefined)
            : await transcrire(
                cle,
                { blob: new Blob([clip.buffer], { type: clip.mime }), nom: clip.fichier },
                { apiKey, prompt },
              );
          if (!opt.simulation) writeFileSync(cacheFichier, JSON.stringify(res));
        } catch (e) {
          res = {
            erreur: `${e instanceof MoteurRefus ? 'REFUS ' : 'PANNE '}${e.message}`,
            latence_ms: null,
            modele: moteur.modele,
            glossaire: moteur.glossaire,
          };
        }
      }
      const duree = clip.duree_s ?? res.duree_s ?? null;
      const ligne = {
        clip: clip.nom,
        moteur: cle,
        modele: res.modele,
        glossaire: res.glossaire,
        taille_octets: clip.taille,
        duree_s: duree,
        latence_ms: res.latence_ms,
        cout_usd: duree ? (duree / 60) * (PRIX_PAR_MINUTE_USD[moteur.modele] ?? 0) : null,
        erreur: res.erreur ?? null,
        tags: clip.meta.tags ?? {},
      };
      if (!res.erreur) {
        ligne.mesures = mesurer({
          reference: clip.reference,
          hypothese: res.texte,
          termes,
          noms,
          nombres: clip.meta.nombres,
          references: clip.meta.references,
        });
        ligne.segments = res.segments?.length ?? 0;
        writeFileSync(join(sortie, `${clip.nom}.${cle}.txt`), res.texte + '\n');
        if (res.segments)
          writeFileSync(
            join(sortie, `${clip.nom}.${cle}.segments.json`),
            JSON.stringify(res.segments, null, 2),
          );
        console.log(
          `WER ${(ligne.mesures.wer * 100).toFixed(1)} %  termes ${String(ligne.mesures.termes.reconnus)}/${String(ligne.mesures.termes.attendus)}  ${res.latence_ms ? `${String(res.latence_ms)} ms` : ''}`,
        );
      } else {
        console.log(ligne.erreur.slice(0, 100));
      }
      resultats.push(ligne);
    }
    // Si un moteur a donné la durée (whisper verbose_json), on la propage au coût des autres.
    const dureeTrouvee = resultats
      .filter((r) => r.clip === clip.nom)
      .map((r) => r.duree_s)
      .find((d) => typeof d === 'number');
    if (dureeTrouvee)
      for (const r of resultats)
        if (r.clip === clip.nom && !r.duree_s) {
          r.duree_s = dureeTrouvee;
          r.cout_usd = (dureeTrouvee / 60) * (PRIX_PAR_MINUTE_USD[r.modele] ?? 0);
        }
  }

  writeFileSync(
    join(sortie, 'resultats.json'),
    JSON.stringify(
      { genere: new Date().toISOString(), simulation: opt.simulation, prompt, resultats },
      null,
      2,
    ),
  );
  const rapport = construireRapport({
    resultats,
    moteurReference: 'actuel',
    libelles: Object.fromEntries(Object.entries(MOTEURS).map(([k, v]) => [k, v.libelle])),
    glossairePaires: [
      ['gpt-transcribe', 'gpt-transcribe+glossaire'],
      ['actuel', 'gpt-4o-transcribe+glossaire'],
    ],
  });
  writeFileSync(join(sortie, 'rapport.md'), rapport);
  console.log(`\nRapport : ${join(sortie, 'rapport.md')}`);
  console.log(`Transcriptions : ${sortie}/<clip>.<moteur>.txt`);
}

if (
  import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` ||
  process.argv[1]?.endsWith('stt-benchmark.mjs')
) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
