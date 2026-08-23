import { useState } from 'react';
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

  if (!isOpen) return null;

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

  return (
    <div className="bg-surface-sunken/80 animate-in fade-in fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md duration-200">
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
                Installer REZO360 sur votre appareil
              </h2>
              <p className="text-muted-foreground text-xs">
                Vos interventions et vos outils de calcul, en plein écran, comme une application native.
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

        <div className="space-y-4 p-5">
          {/* Bouton d'installation permanent */}
          {!isInstalled && (
            <div className="flex flex-col gap-3 p-4 rounded-xl bg-primary/10 border border-primary/30 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Installation rapide sur cet appareil
                  </h3>
                  <p className="text-2xs text-muted-foreground">
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
                  className="w-full sm:w-auto font-bold gap-2 shadow-sm cursor-pointer shrink-0"
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
