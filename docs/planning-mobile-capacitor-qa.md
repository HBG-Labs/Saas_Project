# Planning mobile — recette Capacitor

Cette refonte ne crée pas de projet iOS sur une machine Windows. Le code partagé est prêt pour
Android et iOS ; la validation native iOS doit être exécutée sur macOS après `npx cap add ios` (si
le projet iOS n'existe toujours pas) puis `npx cap sync ios`.

## Commandes de validation native

Android requiert un JDK compatible avec Capacitor et un SDK Android configuré (`JAVA_HOME` et
`ANDROID_HOME`). Depuis la racine du dépôt :

```powershell
npx cap sync android
cd android
.\gradlew.bat :app:assembleDebug
```

Sur macOS, après ajout du projet iOS si nécessaire :

```bash
npx cap sync ios
npx cap open ios
```

Compiler ensuite l'application avec Xcode sur un simulateur puis sur un appareil physique afin de
valider les safe areas, les liens `tel:`, la localisation ponctuelle et le feedback haptique.

## Matrice minimale

- Largeurs Web : 320, 360, 375, 390, 412 et 430 px, puis tablette.
- Android : retour système dans les filtres et les fiches, clavier ouvert, barre gestuelle,
  `tel:`, application cartographique, localisation refusée/acceptée et connexion instable.
- iOS : encoche et Dynamic Island, indicateur d'accueil, clavier, retour par geste, `tel:`,
  application cartographique, localisation refusée/acceptée et connexion instable.
- Accessibilité : VoiceOver/TalkBack, ordre du focus, libellés des statuts, taille des cibles,
  contraste des fonds pastel et réduction des animations.

## Configuration iOS requise

Ajouter dans `ios/App/App/Info.plist`, avant l'archive :

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>REZO360 utilise votre position uniquement lorsque vous demandez « Ma position ».</string>
```

Aucune permission de localisation en arrière-plan ne doit être ajoutée. La fonctionnalité appelle
une position ponctuelle et ne démarre aucun suivi continu.

## Scénarios Planning

1. Jour sans intervention, avec une intervention, puis avec plus de vingt interventions.
2. Jour/Semaine/Mois/Liste et navigation aux périodes précédente/suivante.
3. Filtres combinés, réinitialisation, technicien absent et équipe de plusieurs membres.
4. Titre long, données client/site/adresse/téléphone manquantes, priorité haute et mission annulée.
5. Ouverture de la fiche, appel, itinéraire, retour au jour d'origine et création préremplie.
6. Congés, tâches récurrentes, jours fériés, import et export ICS.
7. Compte sans droit de création, rôle technicien et rôle gestionnaire.
