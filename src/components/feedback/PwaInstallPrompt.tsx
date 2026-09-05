import { Download, Smartphone, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { usePwaInstall } from './usePwaInstall';

export function PwaInstallBanner() {
  const { isInstallable, installPwa } = usePwaInstall();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem('pwa_prompt_dismissed') === 'true';
    } catch {
      return false;
    }
  });

  if (!isInstallable || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem('pwa_prompt_dismissed', 'true');
    } catch {
      // Stockage inaccessible
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-primary/10 border border-primary/30 text-foreground shadow-xs animate-in fade-in slide-in-from-top-2">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="size-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0">
          <Smartphone className="size-4" />
        </div>
        <div className="min-w-0">
          <h4 className="text-xs font-bold text-foreground truncate">
            Installer REZO360 sur votre écran d'accueil
          </h4>
          <p className="text-3xs text-muted-foreground truncate">
            Accès instantané, plein écran et fonctionnement hors-ligne optimisé.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => void installPwa()}
          className="text-2xs font-bold gap-1 h-7.5 px-3 cursor-pointer shadow-xs"
        >
          <Download className="size-3" />
          <span>Installer</span>
        </Button>
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 text-muted-foreground hover:text-foreground rounded-md cursor-pointer"
          title="Fermer"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
