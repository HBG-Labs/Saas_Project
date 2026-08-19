import { Apple, Globe, MonitorSmartphone, Smartphone, X } from 'lucide-react';

import { Button } from '@/components/ui/Button';

/**
 * Installer REZO360 sur un téléphone.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CETTE MODALE PROMETTAIT, ET QUI N'EXISTAIT PAS
 *
 * Elle proposait « Télécharger l'APK Android (84 MB) ». Le clic fabriquait un
 * FICHIER TEXTE nommé `REZO360-Mobile-Android-v2.4.apk`, contenant trois lignes
 * dont `Org ID: org-demo`. Le client tentait de l'installer, échouait, et se
 * retrouvait avec un `.apk` non installable — ce qui, pour un utilisateur
 * averti, ressemble à un logiciel malveillant.
 *
 * Quatre autres affirmations étaient fausses : une version « v2.4.0 » qui
 * n'existe pas, une taille de 84 Mo, un « QR Code » qui n'était qu'un dessin de
 * rectangles impossible à scanner, et une mention « Certifié Google Play
 * Protect & Apple Enterprise Signed ».
 *
 * Aucun projet natif n'existe : ni `android/`, ni `ios/`. Il n'y a rien à
 * télécharger, et il n'y aura rien avant qu'on ait décidé d'en construire.
 *
 * CE QU'ELLE DIT MAINTENANT, ET QUI EST VRAI
 *
 * REZO360 est une application web installable — `site.webmanifest` la déclare
 * en `display: standalone`. Ajoutée à l'écran d'accueil, elle s'ouvre en plein
 * écran, sans barre d'adresse, avec son icône. C'est la seule chose que nous
 * savons offrir aujourd'hui ; c'est donc la seule que nous proposons.
 * ─────────────────────────────────────────────────────────────────────────────
 */

interface DownloadAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Marches à suivre, par plateforme. Aucune n'exige de magasin d'applications. */
const PARCOURS = [
  {
    id: 'android',
    icone: Globe,
    titre: 'Android — Chrome',
    etapes: [
      'Ouvrez rezo360.fr dans Chrome.',
      'Menu ⋮ en haut à droite.',
      '« Installer l’application » ou « Ajouter à l’écran d’accueil ».',
    ],
  },
  {
    id: 'ios',
    icone: Apple,
    titre: 'iPhone / iPad — Safari',
    etapes: [
      'Ouvrez rezo360.fr dans Safari.',
      'Bouton Partager, en bas de l’écran.',
      '« Sur l’écran d’accueil ».',
    ],
  },
  {
    id: 'desktop',
    icone: MonitorSmartphone,
    titre: 'Ordinateur',
    etapes: [
      'Chrome ou Edge affichent une icône d’installation dans la barre d’adresse.',
      'L’application s’ouvre alors dans sa propre fenêtre.',
    ],
  },
] as const;

export function DownloadAppModal({ isOpen, onClose }: DownloadAppModalProps) {
  if (!isOpen) return null;

  return (
    <div className="bg-surface-sunken animate-in fade-in fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-title"
        className="border-border bg-surface text-foreground animate-in zoom-in-95 relative w-full max-w-2xl overflow-hidden rounded-2xl border shadow-2xl duration-200"
      >
        <div className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="border-border flex items-center justify-between border-b p-5">
          <div className="flex items-center gap-3">
            <div className="text-primary flex size-10 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10">
              <Smartphone className="size-5" />
            </div>
            <div>
              <h2 id="install-title" className="text-foreground text-lg font-bold">
                Installer REZO360 sur votre téléphone
              </h2>
              <p className="text-muted-foreground text-xs">
                Vos interventions et vos outils de calcul, en plein écran, comme une application.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="text-muted-foreground hover:bg-surface-raised hover:text-foreground cursor-pointer rounded-lg p-1.5 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-3 p-5">
          {/*
            Dit d'emblée, et non en petits caractères : quelqu'un qui ouvre
            cette fenêtre cherche un magasin d'applications. Lui laisser lire
            trois marches à suivre avant de comprendre qu'il n'y en a pas
            serait une perte de temps déguisée en explication.
          */}
          <p className="border-border bg-surface-sunken text-muted-foreground rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed">
            REZO360 ne passe pas par les magasins d’applications. Il s’installe{' '}
            <strong className="text-foreground">directement depuis votre navigateur</strong> — rien
            à télécharger, aucune mise à jour à suivre : vous avez toujours la dernière version.
          </p>

          <div className="grid gap-2.5 sm:grid-cols-3">
            {PARCOURS.map((parcours) => {
              const Icone = parcours.icone;

              return (
                <div
                  key={parcours.id}
                  className="border-border bg-surface-sunken flex flex-col gap-2 rounded-xl border p-3.5"
                >
                  <div className="text-foreground flex items-center gap-2 text-xs font-bold">
                    <Icone className="text-primary size-4 shrink-0" aria-hidden="true" />
                    {parcours.titre}
                  </div>
                  <ol className="text-muted-foreground space-y-1.5 text-2xs leading-relaxed">
                    {parcours.etapes.map((etape, index) => (
                      <li key={etape} className="flex gap-1.5">
                        <span className="text-subtle-foreground font-mono">{index + 1}.</span>
                        <span>{etape}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-border bg-surface-sunken text-subtle-foreground flex items-center justify-between border-t px-6 py-3.5 text-2xs">
          <span>
            Une application native Android et iOS est envisagée, sans date annoncée à ce jour.
          </span>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
}
