# Benchmark de la reconnaissance vocale

Compare, sur les mêmes audios, le moteur en production et les candidats.
Le corpus (audio, références, résultats) reste **sur votre poste** : le
dossier `benchmark/stt/` est gitignoré. Seuls ce README et le glossaire
pilote (données fictives) sont versionnés.

## 1. Enregistrer vos clips

Depuis votre **téléphone**, avec l'application dictaphone (ou REZO360 → Boîte
à outils → Dictaphone), 30 s à 3 min chacun. Ne lisez pas un texte : parlez
comme sur le terrain. Un clip = une situation :

| Nom du fichier | Situation |
|---|---|
| `calme-standard-01` | intérieur calme, français standard |
| `calme-antillais-01` | intérieur calme, accent antillais |
| `calme-guyanais-01` | intérieur calme, accent guyanais |
| `bruit-chantier-01` | extérieur, bruit de chantier ou de route |
| `bruit-vehicule-01` | dans le véhicule, moteur en marche |
| `technique-fibre-01` | vocabulaire fibre : PTO, PBO, 36FO, jarretière, réflectométrie… |
| `technique-elec-01` | vocabulaire électricité : différentiel, tableau, NF C 15-100, sections… |
| `noms-clients-01` | noms de clients, de sites, de communes, de techniciens (**fictifs** ou avec leur accord) |
| `chiffres-01` | montants, quantités, références, un numéro de téléphone, une adresse complète |
| `deux-voix-01` | deux personnes qui parlent (si possible) |

Numérotez pour en ajouter (`bruit-chantier-02`…). Le script tourne avec
ce qui est présent : un seul clip suffit pour commencer.

Formats acceptés : `.m4a` (iPhone, Android), `.webm`, `.mp3`, `.mp4`, `.wav`.
Taille : 25 Mo au plus par clip (limite de l'API).

## 2. Écrire la référence

Pour chaque clip, un fichier texte du **même nom** : `calme-standard-01.txt`.
C'est ce que vous avez **réellement dit**, mot pour mot, écouté au casque :

- ponctuation normale, majuscules aux noms propres ;
- les nombres en chiffres (« 36FO », « 1 250 euros », « 12 rue des Flamboyants ») ;
- les sigles tels qu'on les écrit (« PTO », « NF C 15-100 ») ;
- gardez les hésitations audibles (« euh ») seulement si elles sont nettes.

La référence est la vérité : une référence approximative fausse toutes les
mesures.

## 3. Facultatif : préciser les attendus

`calme-standard-01.meta.json` :

```json
{
  "duree_s": 74,
  "termes": ["PTO", "36FO", "réflectométrie"],
  "noms": ["Caraïbe Télécom", "Le Lorrain", "Karim"],
  "references": ["36FO", "NF C 15-100"],
  "nombres": ["1250", "12"],
  "tags": { "accent": "antillais", "bruit": "chantier", "voix": 1 }
}
```

Sans ce fichier, le script déduit : les termes = ceux du glossaire pilote
présents dans la référence ; les nombres et références par motif ; les noms
propres par une heuristique (mots capitalisés hors début de phrase) — moins
fiable, d'où l'intérêt de les lister. `duree_s` sert au coût ; sans lui,
whisper-1 la fournit quand il est dans la liste des moteurs.

## 4. Lancer

```
OPENAI_API_KEY=sk-... node scripts/stt-benchmark.mjs
```

PowerShell : `$env:OPENAI_API_KEY = "sk-..."; node scripts/stt-benchmark.mjs`

Options : `--moteurs actuel,gpt-transcribe` · `--clips calme-standard-01`
· `--force` (ignore le cache) · `--simulation` (sans réseau, moteurs
factices : vérifie l'outillage, ne mesure rien). `--help` liste les moteurs.

Coût : ~0,006 $ par minute d'audio et par moteur — 25 clips × 5 moteurs ≈ 1 $.

## 5. Lire

`benchmark/stt/out/<horodatage>/rapport.md` : moyenne et médiane par moteur,
comparaison au moteur actuel, régressions, effet du glossaire, détail par
clip. Les transcriptions produites sont à côté (`<clip>.<moteur>.txt`) pour
comparaison manuelle, et `resultats.json` porte toutes les mesures.

Critère de bascule : le candidat fait mieux (WER et rappel des termes
métier) sur au moins 80 % des clips, sans échec nouveau. Un clip où tous les
moteurs manquent les mêmes mots met en cause la capture, pas le moteur.
