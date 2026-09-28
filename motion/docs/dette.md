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

## Technique

- **CI Linux** : voir `.github/workflows/motion-render.yml` et le rapport de clôture P1.3.
- **Licence Remotion** : `docs/licence-remotion.md` (UNCONFIRMED).
- **Voix** : parole seulement estimée (`timing_source: estimated`) ;
  `VoiceAlignment` n'a pas de producteur ; `voice_breath` réservée.
- **Budget d'attention** : pic mesuré aux seuls instants de début de comportement.
