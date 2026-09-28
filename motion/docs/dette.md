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

### Contraste texte / image non vérifié (P1.4)

Le moteur vérifie les contrastes de palette du style, pas celui d'un texte posé
sur une image : il ne lit pas les pixels. Visible avec SIGNAL sur la spec
visuelle (texte noir sur le ciel assombri par le voile). Solde : luminance par
région déclarée dans l'asset (ou mesurée à l'import), puis contrôle au compilateur.

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
