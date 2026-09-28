# Dette du moteur de motion design

Registre des dettes connues et acceptées. Chaque entrée dit pourquoi elle est
acceptée et ce qui la soldera. Une dette ne se corrige pas « en passant » si
cela change une référence validée : elle passe par une nouvelle version.

## Créative

### SIGNAL — accent trop discret (clôture P1.3)

`fixture_signal` 1.2.0 : `ACCENT_WORD` à `accent_scale` 1,01 pendant ~150 ms
(0,5 beat × 300 ms). Visible sur la planche P1.3 : l'accent se lit à peine.
Techniquement correct (valeurs du profil), **insuffisant comme référence
créative définitive**. Non corrigé : la baseline P1.3 serait modifiée.
Solde : nouvelle version du profil, mesurée et comparée à 1.2.0.

### NOCTURNE — baseline P1.3

Calibration `control_nocturne` validée comme baseline (27/09/2026). Toute
évolution passe par une nouvelle version du profil, comparable à celle-ci.

### Contraste texte / image — SOLDÉ en P1.5 (plancher technique uniquement)

Mesuré dans les pixels, sous l'encre réelle, après traitement (voir
`docs/P1.5-visual-integrity.md`). Reste créatif : SIGNAL passe à 3,25:1 sur
l'image (plancher 3:1) — techniquement valide, pas un contraste « agence » ; son
accent rouge sur l'image est refusé (1,16:1).

### Limites connues de la mesure de contraste (P1.5)

- Cellules d'analyse de 4 px : écart de luminance jusqu'à ~0,065 sur les bords nets
  (lune, cratères) ; écart moyen ≤ 0,0015. Métrique complète : ≤ 0,16 % mesuré.
- Grain du style non modélisé (ni rendu) ; coins arrondis d'un masque rectangulaire
  ignorés ; opacité de groupe approchée (exacte à opacité 1).
- Texte évalué à sa position de repos ; les frames d'entrée et de sortie du texte
  ne sont pas examinées.

### Espace fine insécable absente des polices (P1.4)

Aucune des polices du dépôt (Playfair Display, IBM Plex Mono, Archivo, sous-ensembles
« latin ») n'a U+202F. Repli déclaré vers U+00A0 (même comportement de coupure,
espace plus large), tracé dans le plan (`provenance.typography.substitutions`).
Solde : sous-ensembles de polices incluant U+202F.

## Technique

- **Profils Chrome orphelins (corrigé en P1.4)** : sous Windows, Remotion supprimait
  le profil temporaire pendant que Chrome le verrouillait encore ; ~56 Mo restaient par
  rendu (308 profils, 3,9 Go, disque plein). Le pipeline ouvre désormais son propre
  navigateur, le ferme, puis supprime le profil avec reprises.
  **P1.5** : fuite résiduelle intermittente (31 profils pendant les campagnes d'images
  fixes) — Remotion lance `taskkill` sans l'attendre, et Chrome mourant recréait des
  fichiers après la suppression. Correctif : suppression vérifiée jusqu'à stabilité
  (le dossier ne doit pas réapparaître) ; test de fuite étendu aux images fixes
  enchaînées. La course étant intermittente, le test ne la déclenche pas à coup sûr.
- **Texte** : pas de césure ; coupure seulement sur U+0020 ; alignement optique
  horizontal uniquement (pas de compensation verticale de ponctuation suspendue).
- **Ajustement** : pas de 1 % de la taille du rôle ; aucune variation d'interlignage.
- **Images** : PNG et JPEG seulement ; grain du style non rendu ; duotone approché
  (niveaux de gris + voile déclaré).

- **CI Linux** : voir `.github/workflows/motion-render.yml` et le rapport de clôture P1.3.
- **Licence Remotion** : `docs/licence-remotion.md` (UNCONFIRMED).
- **Voix** : parole seulement estimée (`timing_source: estimated`) ;
  `VoiceAlignment` n'a pas de producteur ; `voice_breath` réservée.
- **Budget d'attention** : pic mesuré aux seuls instants de début de comportement.
