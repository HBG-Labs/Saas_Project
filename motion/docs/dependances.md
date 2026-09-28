# Dépendances d'exécution du cœur (`@motion-engine/core`)

Chaque dépendance est **épinglée à une version exacte** (`package.json`, `package-lock.json`)
et figure dans la provenance lorsqu'elle peut influencer un résultat.

| Paquet | Version | Licence | Pourquoi | Provenance |
|---|---|---|---|---|
| `zod` | 4.4.3 | MIT | Contrats stricts des documents. | — (validation, n'influence aucun résultat) |
| `harfbuzzjs` | 1.6.2 (HarfBuzz 14.5.0) | MIT | P1.4 : mise en forme et mesure réelles du texte, avec le même moteur que Chromium. | `render-plan.provenance.typography.shaper` |
| `jpeg-js` | 0.4.4 | BSD-3-Clause | P1.5 : décodage JPEG **pur JavaScript, sans code natif**, pour l'analyse des pixels à l'import. Le PNG est décodé par `zlib` (Node) et un défiltrage interne ; aucune dépendance native. | `asset-analysis.decoder` (`jpeg-js@0.4.4`), repris dans `render-plan.provenance.visual.analyses[].decoder` |

## jpeg-js — vérifications (P1.5)

- Licence lue dans le paquet installé : BSD-3-Clause (Eugene Ware, 2014) — permissive,
  compatible avec un usage commercial, attribution à conserver en cas de redistribution.
- Aucune dépendance transitive (`dependencies: {}`).
- Déterminisme : décodeur entier pur JavaScript ; mêmes octets + même version → mêmes pixels.
  Un JPEG et un PNG de la même image ne produisent pas la même analyse (encodages
  différents) : ce n'est pas une promesse du moteur.
- Changer de version de `jpeg-js` impose d'incrémenter `ANALYSIS_ALGORITHM_VERSION`
  (`core/src/visual/analysis.ts`), ce qui invalide le cache des analyses.
