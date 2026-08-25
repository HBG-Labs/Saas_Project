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
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-title"
        className="border-slate-800 bg-slate-900/98 text-slate-100 dark:border-slate-800 dark:bg-slate-950 text-foreground animate-in zoom-in-95 relative w-full max-w-2xl max-h-[88dvh] flex flex-col overflow-hidden rounded-2xl border shadow-2xl duration-200 my-auto"
      >
        <div className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-blue-500/10 blur-3xl" />

        {/* En-tête fixe / persistant */}
        <div className="border-slate-800 bg-slate-900/98 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between border-b p-3.5 sm:p-5 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="text-cyan-400 flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-xl border border-cyan-500/25 bg-cyan-950/60 shadow-xs">
              <Smartphone className="size-4 sm:size-5" />
            </div>
            <div className="min-w-0">
              <h2 id="install-title" className="text-white text-sm sm:text-base font-bold truncate">
                Installer REZO360 sur votre appareil
              </h2>
              <p className="text-slate-400 text-3xs sm:text-xs truncate">
                Vos interventions et vos outils de calcul, en plein écran, comme une application native.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer rounded-lg p-1.5 transition-colors shrink-0"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Corps de modale défilable verticalement */}
        <div className="space-y-3.5 sm:space-y-4 p-3.5 sm:p-5 overflow-y-auto flex-1 overscroll-contain">
          {/* Bouton d'installation permanent */}
          {!isInstalled && (
            <div className="flex flex-col gap-3 p-3.5 sm:p-4 rounded-xl bg-primary/10 border border-primary/30 shadow-2xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-foreground">
                    Installation rapide sur cet appareil
                  </h3>
                  <p className="text-3xs sm:text-2xs text-muted-foreground">
                    {isInstallable
                      ? "Votre navigateur est prêt pour l'installation instantanée en 1 clic."
                      : "Installez REZO360 en mode application plein écran pour vos interventions."}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={handleDirectInstall}
                  className="w-full sm:w-auto font-bold gap-2 shadow-2xs cursor-pointer shrink-0 h-9 text-xs sm:text-sm"
                >
                  <Download className="size-4" />
                  <span>Installer maintenant</span>
                </Button>
              </div>

              {browserHelp && (
                <div className="p-3 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-900 dark:text-blue-200 text-xs font-medium animate-in fade-in">
                  {browserHelp}
                </div>
              )}
            </div>
          )}

          {isInstalled && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>REZO360 est déjà installé sur cet appareil en mode application.</span>
            </div>
          )}

          <p className="border border-slate-800 bg-slate-950/60 text-slate-400 rounded-xl p-3 sm:px-3.5 sm:py-2.5 text-xs leading-relaxed">
            REZO360 ne passe pas par les magasins d’applications. Il s’installe{' '}
            <strong className="text-white">directement depuis votre navigateur</strong> — rien
            à télécharger, aucune mise à jour à suivre : vous avez toujours la dernière version.
          </p>

          <div className="grid gap-2.5 sm:grid-cols-3">
            {PARCOURS.map((parcours) => {
              const Icone = parcours.icone;

              return (
                <div
                  key={parcours.id}
                  className="border border-slate-800 bg-slate-950/60 flex flex-col gap-2 rounded-xl p-3 sm:p-3.5"
                >
                  <div className="text-slate-200 flex items-center gap-2 text-xs font-bold">
                    <Icone className="text-cyan-400 size-4 shrink-0" aria-hidden="true" />
                    {parcours.titre}
                  </div>
                  <ol className="text-slate-400 space-y-1.5 text-3xs sm:text-2xs leading-relaxed">
                    {parcours.etapes.map((etape, index) => (
                      <li key={etape} className="flex gap-1.5">
                        <span className="text-slate-500 font-mono">{index + 1}.</span>
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
        <div className="border-slate-800 bg-slate-900/98 text-slate-400 sticky bottom-0 z-20 flex items-center justify-between border-t px-4 py-2.5 sm:px-6 sm:py-3.5 text-3xs sm:text-2xs shrink-0">
          <span className="pr-2 line-clamp-1">
            Application web progressive (PWA) ultra-rapide et sécurisée.
          </span>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs text-slate-300 hover:text-white hover:bg-slate-800 shrink-0">
            Fermer
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
