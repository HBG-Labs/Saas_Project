import { useState } from 'react';
import { Apple, CheckCircle2, Download, Globe, MonitorSmartphone, Smartphone } from 'lucide-react';

import { usePwaInstall } from '@/components/feedback/usePwaInstall';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface DownloadAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Domaine à taper, affiché aux étapes Android/iPhone, sous le QR code et dans
 * son attribut `alt`. Le SVG lui-même encode `https://` + ce même domaine —
 * voir la constante `INSTALL_URL` de `scripts/generate-install-qr.mjs`, à
 * modifier en même temps que celle-ci si l'adresse change un jour.
 */
const INSTALL_URL = 'rezo360.com';

/** Marches à suivre, par plateforme. Aucune n'exige de magasin d'applications. */
const PARCOURS = [
  {
    id: 'android',
    icone: Globe,
    titre: 'Android — Chrome',
    etapes: [
      `Ouvrez ${INSTALL_URL} dans Chrome.`,
      'Menu ⋮ en haut à droite.',
      '« Installer l’application » ou « Ajouter à l’écran d’accueil ».',
    ],
  },
  {
    id: 'ios',
    icone: Apple,
    titre: 'iPhone / iPad — Safari',
    etapes: [
      `Ouvrez ${INSTALL_URL} dans Safari.`,
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

  const handleOpenChange = (open: boolean) => {
    if (open) return;
    setBrowserHelp(null);
    onClose();
  };

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
    <Modal
      open={isOpen}
      onOpenChange={handleOpenChange}
      title="Installer REZO360 sur votre appareil"
      description="Vos interventions et vos outils de calcul, en plein écran, comme une application native."
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <span className="text-muted-foreground line-clamp-1 text-3xs sm:text-2xs">
            Application web progressive, rapide et toujours à jour.
          </span>
          <Button variant="ghost" size="sm" onClick={onClose} className="shrink-0">
            Fermer
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {!isInstalled ? (
          <section className="border-primary/25 bg-primary/10 rounded-xl border p-4">
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 items-start gap-3">
                <div className="border-primary/20 bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl border">
                  <Smartphone className="size-5" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold sm:text-base">
                    Installation rapide sur cet appareil
                  </h3>
                  <p className="text-muted-foreground text-xs leading-relaxed sm:text-sm">
                    {isInstallable
                      ? "Votre navigateur est prêt : l'installation se lance en un clic."
                      : 'Installez REZO360 en plein écran pour accéder plus vite à vos interventions.'}
                  </p>
                </div>
              </div>

              <Button
                variant="primary"
                size="md"
                onClick={handleDirectInstall}
                className="w-full shrink-0 sm:w-auto"
                leadingIcon={<Download className="size-4" aria-hidden="true" />}
              >
                Installer maintenant
              </Button>
            </div>

            {browserHelp ? (
              <p
                role="status"
                className="border-border bg-surface text-foreground mt-3 rounded-lg border p-3 text-xs leading-relaxed"
              >
                {browserHelp}
              </p>
            ) : null}
          </section>
        ) : (
          <div
            role="status"
            className="border-success/30 bg-success/10 text-success flex items-center gap-2.5 rounded-xl border p-3 text-xs font-semibold"
          >
            <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
            <span>REZO360 est déjà installé sur cet appareil.</span>
          </div>
        )}

        <p className="border-border bg-surface-sunken text-muted-foreground rounded-xl border px-3.5 py-3 text-xs leading-relaxed">
          REZO360 ne passe pas par les magasins d’applications. Il s’installe{' '}
          <strong className="text-foreground">directement depuis votre navigateur</strong> : rien
          à télécharger et aucune mise à jour à suivre.
        </p>

        <div className="grid gap-2.5 sm:grid-cols-3">
          {PARCOURS.map((parcours) => {
            const Icone = parcours.icone;

            return (
              <section
                key={parcours.id}
                className="border-border bg-surface-sunken flex flex-col gap-2 rounded-xl border p-3.5"
                aria-labelledby={`install-${parcours.id}`}
              >
                <h3
                  id={`install-${parcours.id}`}
                  className="text-foreground flex items-center gap-2 text-xs font-semibold"
                >
                  <Icone className="text-primary size-4 shrink-0" aria-hidden="true" />
                  {parcours.titre}
                </h3>
                <ol className="text-muted-foreground space-y-1.5 text-2xs leading-relaxed">
                  {parcours.etapes.map((etape, index) => (
                    <li key={etape} className="flex gap-1.5">
                      <span className="font-mono" aria-hidden="true">
                        {index + 1}.
                      </span>
                      <span>{etape}</span>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}
        </div>

        <div className="border-border bg-surface-sunken flex items-center gap-3.5 rounded-xl border p-3.5">
          <img
            src="/images/rezo360-install-qr.svg"
            alt={`QR code vers ${INSTALL_URL}`}
            width={72}
            height={72}
            className="border-border size-18 shrink-0 rounded-lg border bg-white p-1.5"
          />
          <div className="min-w-0 space-y-1">
            <p className="text-foreground text-sm font-semibold">Ouvrir sur un téléphone</p>
            <p className="text-muted-foreground text-2xs leading-relaxed">
              Scannez ce code pour ouvrir directement {INSTALL_URL}, sans saisir l’adresse.
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
