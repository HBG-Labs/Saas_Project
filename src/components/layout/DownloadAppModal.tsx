import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Apple, CheckCircle2, Download, Globe, MonitorSmartphone, Smartphone, X } from 'lucide-react';

import { usePwaInstall } from '@/components/feedback/PwaInstallPrompt';
import { Button } from '@/components/ui/Button';

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
  const { isInstallable, isInstalled, installPwa } = usePwaInstall();
  const [browserHelp, setBrowserHelp] = useState<string | null>(null);

  // Fermer la modale avec la touche Échap
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const handleDirectInstall = async () => {
    setBrowserHelp(null);
    const success = await installPwa();
    if (success) {
      onClose();
    } else {
      setBrowserHelp(
        "💡 Astuce d'installation : Cliquez sur la petite icône d'installation 📥 ou ⊕ située tout à droite dans la barre d'adresse de votre navigateur Chrome / Edge (ou via le menu ⋮ > « Installer l’application »)."
      );
    }
  };

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="bg-black/70 animate-in fade-in fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 backdrop-blur-md duration-200 overflow-y-auto"
    >
      {/*
        CETTE MODALE AVAIT ÉTÉ ÉCRITE POUR LE THÈME SOMBRE, ET SEULEMENT LUI.

        Elle codait `text-white` en dur à cinq endroits et empilait des fonds
        `bg-primary/50` à `/70`. En thème sombre le résultat tenait : le blanc
        se détachait sur `--surface-sunken: #070c11`. En thème clair, le même
        token vaut `#e6ecf1` — du blanc dessus donne 1,16:1. Le titre et la
        mention « directement depuis votre navigateur » étaient illisibles, et
        le sous-titre de l'encadré, en `text-muted-foreground` sur un bleu
        dilué, tombait vers 2,4:1.

        D'où le passage aux paires sémantiques : la couleur du texte vient
        toujours du même jeu de tokens que la surface qui le porte, et les
        fonds ne sont plus dilués par une opacité qui rend le résultat
        imprévisible.
      */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-title"
        className="border-border bg-surface-raised text-foreground animate-in zoom-in-95 relative w-full max-w-2xl max-h-[88dvh] flex flex-col overflow-hidden rounded-2xl border shadow-2xl duration-200 my-auto"
      >
        <div className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-primary/10 blur-3xl" />

        {/* En-tête fixe / persistant */}
        <div className="border-border bg-surface-raised sticky top-0 z-20 flex items-center justify-between border-b p-3.5 sm:p-5 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="text-primary flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
              <Smartphone className="size-4 sm:size-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="install-title"
                className="text-foreground text-sm sm:text-base font-bold truncate"
              >
                Installer REZO360 sur votre appareil
              </h2>
              <p className="text-muted-foreground text-3xs sm:text-xs truncate">
                Vos interventions et vos outils de calcul, en plein écran, comme une application native.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="text-muted-foreground hover:bg-surface-hover hover:text-foreground cursor-pointer rounded-lg p-1.5 transition-colors shrink-0"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Corps de modale défilable verticalement */}
        <div className="space-y-3.5 sm:space-y-4 p-3.5 sm:p-5 overflow-y-auto flex-1 overscroll-contain">
          {/*
            Bouton d'installation permanent, dans un panneau TEINTÉ et non plein.

            Un fond `bg-primary` plein aurait avalé le bouton d'action, qui est
            lui-même en `primary` : deux bleus identiques l'un sur l'autre, et
            l'appel à l'action disparaît. Une teinte à 10 % distingue la zone
            sans entrer en concurrence avec ce qu'on veut faire cliquer.
          */}
          {!isInstalled && (
            <div className="flex flex-col gap-3 p-3.5 sm:p-4 rounded-xl bg-primary/10 border border-primary/25">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-sm sm:text-base font-bold text-foreground tracking-tight">
                    Installation rapide sur cet appareil
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-snug">
                    {isInstallable
                      ? "Votre navigateur est prêt pour l'installation instantanée en 1 clic."
                      : "Installez REZO360 en mode application plein écran pour vos interventions."}
                  </p>
                </div>
                {/*
                  Aucune surcharge de couleur ici : `variant="primary"` porte
                  déjà la paire fond/texte du thème. Les `bg-primary text-white`
                  qui traînaient reproduisaient le défaut d'un cran plus bas —
                  un blanc en dur qui ne suit aucun thème.
                */}
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={handleDirectInstall}
                  className="w-full sm:w-auto shrink-0 gap-2 rounded-xl px-4 font-bold"
                >
                  <Download className="size-4" />
                  <span>Installer maintenant</span>
                </Button>
              </div>

              {browserHelp && (
                <div className="border-border bg-surface text-foreground animate-in fade-in rounded-lg border p-3 text-xs leading-relaxed">
                  {browserHelp}
                </div>
              )}
            </div>
          )}

          {isInstalled && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-success/10 border border-success/30 text-success text-xs font-semibold">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>REZO360 est déjà installé sur cet appareil en mode application.</span>
            </div>
          )}

          <p className="border-border bg-surface-sunken text-muted-foreground rounded-xl border p-3 text-xs leading-relaxed sm:px-3.5 sm:py-2.5">
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
                  className="border-border bg-surface-sunken flex flex-col gap-2 rounded-xl border p-3 sm:p-3.5"
                >
                  <div className="text-muted-foreground flex items-center gap-2 text-xs font-bold">
                    <Icone className="text-primary size-4 shrink-0" aria-hidden="true" />
                    {parcours.titre}
                  </div>
                  <ol className="text-muted-foreground space-y-1.5 text-3xs sm:text-2xs leading-relaxed">
                    {parcours.etapes.map((etape, index) => (
                      <li key={etape} className="flex gap-1.5">
                        <span className="text-muted-foreground font-mono">{index + 1}.</span>
                        <span>{etape}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pied de page fixe / persistant */}
        <div className="border-border bg-surface-raised text-muted-foreground sticky bottom-0 z-20 flex items-center justify-between border-t px-4 py-2.5 sm:px-6 sm:py-3.5 text-3xs sm:text-2xs shrink-0">
          <span className="pr-2 line-clamp-1">
            Application web progressive (PWA) ultra-rapide et sécurisée.
          </span>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground hover:text-foreground hover:bg-surface-hover shrink-0 text-xs">
            Fermer
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
