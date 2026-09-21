/**
 * Le rapport Markdown du benchmark — pur, testable.
 *
 * Entrée : les résultats (un par clip × moteur) et la clé du moteur de
 * référence (« actuel »). Sortie : détail par clip, moyenne et médiane par
 * moteur, comparaison au moteur actuel, régressions, effet du glossaire.
 */
import { mediane, moyenne } from './metriques.mjs';

const pct = (v) => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(1)} %`);
const ms = (v) => (v === null || v === undefined ? '—' : `${String(Math.round(v))} ms`);
const usd = (v) => (v === null || v === undefined ? '—' : `${v.toFixed(4)} $`);

function parMoteur(resultats) {
  const groupes = new Map();
  for (const r of resultats) {
    if (!groupes.has(r.moteur)) groupes.set(r.moteur, []);
    groupes.get(r.moteur).push(r);
  }
  return groupes;
}

function statistiques(lignes) {
  const ok = lignes.filter((r) => !r.erreur);
  const val = (f) => ok.map(f);
  return {
    clips: lignes.length,
    reussis: ok.length,
    echecs: lignes.length - ok.length,
    wer_moyen: moyenne(val((r) => r.mesures.wer)),
    wer_median: mediane(val((r) => r.mesures.wer)),
    termes_moyen: moyenne(val((r) => r.mesures.termes.rappel)),
    termes_median: mediane(val((r) => r.mesures.termes.rappel)),
    noms_moyen: moyenne(val((r) => r.mesures.noms.rappel)),
    nombres_moyen: moyenne(val((r) => r.mesures.nombres.rappel)),
    references_moyen: moyenne(val((r) => r.mesures.references.rappel)),
    ponctuation_moyen: moyenne(val((r) => r.mesures.ponctuation)),
    latence_median: mediane(val((r) => r.latence_ms)),
    cout_total: ok.reduce((s, r) => s + (r.cout_usd ?? 0), 0),
  };
}

/**
 * Sur un clip, un moteur « bat » un autre s'il a un WER plus bas OU un
 * rappel des termes plus haut sans WER plus haut ; il « régresse » si son
 * WER est plus haut de plus de 2 points ou son rappel des termes plus bas.
 */
function comparer(candidat, reference) {
  if (!candidat || !reference || candidat.erreur || reference.erreur) return null;
  const dWer = candidat.mesures.wer - reference.mesures.wer;
  const rc = candidat.mesures.termes.rappel;
  const rr = reference.mesures.termes.rappel;
  const dTermes = rc === null || rr === null ? 0 : rc - rr;
  if (dWer > 0.02 || dTermes < 0) return 'regresse';
  if (dWer < -0.02 || dTermes > 0) return 'ameliore';
  return 'egal';
}

export function construireRapport({
  resultats,
  moteurReference = 'actuel',
  libelles = {},
  glossairePaires = [],
}) {
  const groupes = parMoteur(resultats);
  const moteurs = [...groupes.keys()];
  const clips = [...new Set(resultats.map((r) => r.clip))].sort();
  const lib = (m) => libelles[m] ?? m;
  const lignes = [];

  lignes.push('# Benchmark STT — rapport', '');
  lignes.push(
    `Généré le ${new Date().toISOString()} · ${String(clips.length)} clip(s) · ${String(moteurs.length)} moteur(s)`,
    '',
  );
  lignes.push(
    "Le moteur de référence est celui en production. Un moteur n'est retenu que s'il fait mieux sur au moins 80 % des clips (précision globale et rappel des termes métier) sans problème bloquant.",
    '',
  );

  lignes.push('## 1. Moyenne et médiane par moteur', '');
  lignes.push(
    '| Moteur | Clips OK | WER moyen | WER médian | Termes métier (rappel) | Noms | Nombres | Références | Ponctuation | Latence médiane | Coût |',
  );
  lignes.push('|---|---|---|---|---|---|---|---|---|---|---|');
  const stats = new Map();
  for (const m of moteurs) {
    const s = statistiques(groupes.get(m));
    stats.set(m, s);
    lignes.push(
      `| ${lib(m)} | ${String(s.reussis)}/${String(s.clips)} | ${pct(s.wer_moyen)} | ${pct(s.wer_median)} | ${pct(s.termes_moyen)} (méd. ${pct(s.termes_median)}) | ${pct(s.noms_moyen)} | ${pct(s.nombres_moyen)} | ${pct(s.references_moyen)} | ${pct(s.ponctuation_moyen)} | ${ms(s.latence_median)} | ${usd(s.cout_total)} |`,
    );
  }
  lignes.push('');

  if (groupes.has(moteurReference)) {
    lignes.push(`## 2. Comparaison au moteur actuel (${lib(moteurReference)})`, '');
    lignes.push('| Moteur | Améliore | Égal | Régresse | Part des clips améliorés |');
    lignes.push('|---|---|---|---|---|');
    const ref = new Map(groupes.get(moteurReference).map((r) => [r.clip, r]));
    const regressions = [];
    for (const m of moteurs) {
      if (m === moteurReference) continue;
      let a = 0;
      let e = 0;
      let g = 0;
      for (const r of groupes.get(m)) {
        const verdict = comparer(r, ref.get(r.clip));
        if (verdict === 'ameliore') a += 1;
        else if (verdict === 'egal') e += 1;
        else if (verdict === 'regresse') {
          g += 1;
          regressions.push({
            moteur: m,
            clip: r.clip,
            wer: r.mesures.wer,
            werRef: ref.get(r.clip).mesures.wer,
            termes: r.mesures.termes,
            termesRef: ref.get(r.clip).mesures.termes,
          });
        }
      }
      const total = a + e + g;
      lignes.push(
        `| ${lib(m)} | ${String(a)} | ${String(e)} | ${String(g)} | ${total === 0 ? '—' : pct(a / total)} |`,
      );
    }
    lignes.push('');
    lignes.push("### Cas où un moteur régresse par rapport à l'actuel", '');
    if (regressions.length === 0) lignes.push('Aucun.', '');
    else {
      lignes.push(
        '| Moteur | Clip | WER (actuel → candidat) | Termes reconnus (actuel → candidat) | Termes manqués par le candidat |',
      );
      lignes.push('|---|---|---|---|---|');
      for (const r of regressions) {
        lignes.push(
          `| ${lib(r.moteur)} | ${r.clip} | ${pct(r.werRef)} → ${pct(r.wer)} | ${String(r.termesRef.reconnus)}/${String(r.termesRef.attendus)} → ${String(r.termes.reconnus)}/${String(r.termes.attendus)} | ${r.termes.manques.join(', ') || '—'} |`,
        );
      }
      lignes.push('');
    }
  }

  if (glossairePaires.length > 0) {
    lignes.push('## 3. Effet du glossaire', '');
    for (const [sans, avec] of glossairePaires) {
      if (!groupes.has(sans) || !groupes.has(avec)) continue;
      const sansMap = new Map(groupes.get(sans).map((r) => [r.clip, r]));
      const aide = [];
      const nuit = [];
      for (const r of groupes.get(avec)) {
        const base = sansMap.get(r.clip);
        const verdict = comparer(r, base);
        if (verdict === 'ameliore') aide.push(r.clip);
        if (verdict === 'regresse') nuit.push(r.clip);
      }
      lignes.push(
        `**${lib(sans)} → ${lib(avec)}** : le glossaire améliore ${String(aide.length)} clip(s) [${aide.join(', ') || '—'}], dégrade ${String(nuit.length)} clip(s) [${nuit.join(', ') || '—'}].`,
        '',
      );
    }
  }

  lignes.push('## 4. Détail par clip', '');
  for (const clip of clips) {
    lignes.push(`### ${clip}`, '');
    lignes.push(
      '| Moteur | WER | S/I/D | Termes | Noms | Nombres | Références | Ponct. | Latence | Coût | Erreur |',
    );
    lignes.push('|---|---|---|---|---|---|---|---|---|---|---|');
    for (const m of moteurs) {
      const r = groupes.get(m).find((x) => x.clip === clip);
      if (!r) continue;
      if (r.erreur) {
        lignes.push(
          `| ${lib(m)} | — | — | — | — | — | — | — | ${ms(r.latence_ms)} | — | ${r.erreur.replace(/\|/g, '/').slice(0, 120)} |`,
        );
        continue;
      }
      const w = r.mesures;
      const rap = (x) => (x.attendus === 0 ? '—' : `${String(x.reconnus)}/${String(x.attendus)}`);
      lignes.push(
        `| ${lib(m)} | ${pct(w.wer)} | ${String(w.substitutions)}/${String(w.insertions)}/${String(w.suppressions)} | ${rap(w.termes)} | ${rap(w.noms)} | ${rap(w.nombres)} | ${rap(w.references)} | ${pct(w.ponctuation)} | ${ms(r.latence_ms)} | ${usd(r.cout_usd)} | |`,
      );
    }
    const manques = moteurs
      .map((m) => groupes.get(m).find((x) => x.clip === clip))
      .filter((r) => r && !r.erreur && r.mesures.termes.manques.length > 0)
      .map((r) => `${lib(r.moteur)} : ${r.mesures.termes.manques.join(', ')}`);
    if (manques.length > 0) lignes.push('', `Termes métier manqués — ${manques.join(' · ')}`);
    lignes.push('');
  }

  lignes.push('## 5. Lecture', '');
  lignes.push(
    "- WER : plus bas = mieux ; un même clip peut avoir un WER élevé chez tous les moteurs si la référence est très différente à l'oral (hésitations, reprises) — regarder alors le rappel des termes.",
  );
  lignes.push(
    '- Un clip où TOUS les moteurs échouent sur les mêmes termes désigne plutôt la capture (bruit, distance au micro) que le moteur.',
  );
  lignes.push(
    '- Les transcriptions produites sont dans `out/<horodatage>/<clip>.<moteur>.txt` pour lecture manuelle.',
  );
  lignes.push('');
  return lignes.join('\n');
}
