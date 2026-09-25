# REZO360 — Écrans d’accès ALIVE

## Composition

Connexion : photographie à gauche, formulaire à droite. Inscription : formulaire à gauche, photographie à droite. Sur mobile, le formulaire précède une photographie de 300 px de hauteur. Les champs, erreurs et boutons utilisent les composants existants ; la logique d’authentification est inchangée. Les écrans de récupération et de confirmation héritent du même habillage.

## Photographies et rotation

Cinq photographies originales, générées avec l’outil intégré imagegen (mode built-in, pas de CLI). Aucun asset Tiime n’est repris. Une seule balise image est rendue ; une sélection aléatoire exclut l’image de la visite précédente. La sélection reste fixe pendant toute la saisie, y compris en cas d’erreur. La dernière sélection est conservée dans sessionStorage, avec repli en mémoire si le stockage est indisponible. Une nouvelle visite ou un rechargement effectue un nouveau choix ; il n’y a aucun carrousel automatique.

Exports WebP qualité 84, en 1536 × 1024 et 800 × 533. Seul le format approprié à l’écran est chargé via picture. Les originaux restent dans le dossier de génération Codex.

## Validation

- 30 tests ciblés réussis : inscription, réinitialisation, layout public et rotation des photos.
- Compilation TypeScript et build Vite réussis ; ESLint ciblé sans erreur.
- Vérification visuelle à 1440 × 960, 390 × 844 et 320 × 740. Aucun débordement horizontal observé ; champs mobiles de 48 px et texte à 16 px.
- Navigation connexion → inscription → connexion : photographie différente à chaque visite, une seule image rendue. Aucun compte créé et aucune connexion réelle soumise pendant les vérifications.

## Fichiers et prompts finaux

### login-technician

- `public/images/auth/login-technician-1536.webp`
- `public/images/auth/login-technician-800.webp`

Prompt final :

```text
Use case: photorealistic-natural. Asset type: original full-bleed photograph for REZO360 sign-in page, premium software for field technicians. Generate a single cinematic editorial photograph, landscape 3:2, 1536x1024. A male maintenance technician about 35, short dark hair, lightly weathered face, navy blue work jacket, standing beside an unbranded dark navy service van outside a stone house in rural France, quietly looking down at the smartphone held naturally in his hands at chest level. Medium wide framing from upper thighs upward, subject near center at 55% of image width, face and hands fully within middle 55% of frame so the image also crops beautifully as a tall panel. Early morning golden light edging his face, cool deep navy shadows, muted olive fields and distant hills, authentic everyday setting. Same photographic atmosphere as a cinematic REZO360 landing photo of a technician and navy van on a countryside road at sunrise: warm amber sun, subtle atmospheric haze, restrained contrast, rich dark tones but readable skin, real fabric texture and natural skin pores. Keep subject above center, lower quarter quiet dark foreground suitable for HTML caption overlay. Shot on a 50mm lens with gentle background separation, realistic anatomy and smartphone, understated assured mood. No visible screen contents, no text, no logo, no watermark, no UI, no neon, no futuristic elements, no exaggerated smile, no glossy stock-photo posing.
```

### register-workshop

- `public/images/auth/register-workshop-1536.webp`
- `public/images/auth/register-workshop-800.webp`

Prompt final :

```text
Use case: photorealistic-natural. Asset type: original full-bleed photograph for REZO360 registration page, premium software for field professionals. Generate a single cinematic editorial photograph, landscape 3:2, 1536x1024. A female field maintenance professional about 35, chestnut hair loosely tied back, wearing an unbranded navy blue canvas work jacket, standing in the doorway of a small practical workshop opening onto countryside in France. She holds a closed slim dark tablet comfortably against one hip, looking toward camera with a calm confident welcoming expression and very slight natural smile. Medium wide upper-thigh portrait, person near 48% image width, entire face and hands well inside middle 55% of composition for vertical crops. Warm low morning sunlight from the open doorway, softly illuminated face, textured stone and out of focus equipment in the background, cool deep navy shadows with restrained warm amber highlights. Premium natural documentary photography consistent with REZO360 landing photography of a navy-clad technician and service van at sunrise; authentic field work, modern and grounded. Gentle cinematic depth, subtle film texture, natural skin and practical workwear, 50mm lens. Lower quarter quiet darker foreground for HTML caption, upper subject unobstructed. No text, no logo, no watermark, no UI, no fake app screen, no neon, no futuristic scenery, no glamour, no exaggerated advertising pose.
```

### orchard-technician

- `public/images/auth/orchard-technician-1536.webp`
- `public/images/auth/orchard-technician-800.webp`

Prompt final :

```text
Use case: photorealistic-natural. Create one original premium cinematic editorial photograph for a REZO360 sign-in / registration page. Landscape 3:2, 1536x1024. Authentic French field professional in unbranded navy workwear, medium wide portrait from upper thighs, subject centered between 45% and 55% image width, face and hands entirely within central 55% for tall responsive crops. Same restrained photographic style as a technician beside a navy service van on a rural road at sunrise: natural amber side light, cool navy shadows, subtle atmospheric haze, natural skin and fabric, muted rural colors, 50mm lens and gentle depth. Lower quarter dark quiet foreground for HTML caption. Beautiful believable composition, warm but professional, calm expression. No text, logos, watermarks, UI overlays, visible phone screen contents, neon, artificial blue lighting, glossy stock posing, or exaggerated smile. Scene: a Black female maintenance professional in her early thirties, natural hair tied back, standing beside an unbranded navy utility van on a quiet rural property with olive trees and stone walls, consulting a smartphone naturally held at chest level. Three-quarter view toward the right, warm dawn light softly edging her face, comfortable practical work jacket. Keep setting understated and face readable.
```

### workshop-electrician

- `public/images/auth/workshop-electrician-1536.webp`
- `public/images/auth/workshop-electrician-800.webp`

Prompt final :

```text
Use case: photorealistic-natural. Create one original premium cinematic editorial photograph for a REZO360 sign-in / registration page. Landscape 3:2, 1536x1024. Authentic French field professional in unbranded navy workwear, medium wide portrait from upper thighs, subject centered between 45% and 55% image width, face and hands entirely within central 55% for tall responsive crops. Same restrained photographic style as a technician beside a navy service van on a rural road at sunrise: natural amber side light, cool navy shadows, subtle atmospheric haze, natural skin and fabric, muted rural colors, 50mm lens and gentle depth. Lower quarter dark quiet foreground for HTML caption. Beautiful believable composition, warm but professional, calm expression. No text, logos, watermarks, UI overlays, visible phone screen contents, neon, artificial blue lighting, glossy stock posing, or exaggerated smile. Scene: a male electrician in his late forties, short salt-and-pepper hair and short beard, standing at the threshold of a tidy working maintenance workshop opening onto a stone courtyard, looking calmly toward the camera with a slight welcoming expression, relaxed shoulders. One hand holds a closed slim dark tablet near his waist. Soft golden morning light on the face, practical tools discreetly blurred behind him, absolutely realistic ordinary work environment.
```

### courtyard-technician

- `public/images/auth/courtyard-technician-1536.webp`
- `public/images/auth/courtyard-technician-800.webp`

Prompt final :

```text
Use case: photorealistic-natural. Create one original premium cinematic editorial photograph for a REZO360 sign-in / registration page. Landscape 3:2, 1536x1024. Authentic French field professional in unbranded navy workwear, medium wide portrait from upper thighs, subject centered between 45% and 55% image width, face and hands entirely within central 55% for tall responsive crops. Same restrained photographic style as a technician beside a navy service van on a rural road at sunrise: natural amber side light, cool navy shadows, subtle atmospheric haze, natural skin and fabric, muted rural colors, 50mm lens and gentle depth. Lower quarter dark quiet foreground for HTML caption. Beautiful believable composition, warm but professional, calm expression. No text, logos, watermarks, UI overlays, visible phone screen contents, neon, artificial blue lighting, glossy stock posing, or exaggerated smile. Scene: a female service technician about forty with shoulder-length dark brown hair, standing beside a stone farmhouse and an unbranded dark blue service vehicle at the end of a workday, reading a smartphone in both hands at chest level, her face in three-quarter view facing left, the setting sun behind distant rolling fields. Navy canvas work jacket, gentle amber light on her face, authentic composed expression, full hands visible and anatomically correct.
```
