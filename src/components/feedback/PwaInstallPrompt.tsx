import { Download, Smartphone, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Singleton global pour capturer l'événement dès le premier milliseconde du cycle de vie
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    promptListeners.forEach((fn) => fn());
  });

  window.addEventListener('appinstalled', () => {
    globalDeferredPrompt = null;
    promptListeners.forEach((fn) => fn());
  });
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => globalDeferredPrompt);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    try {
      return (
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(display-mode: standalone)').matches
      );
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const onPromptChange = () => {
      setDeferredPrompt(globalDeferredPrompt);
    };

    promptListeners.add(onPromptChange);

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      promptListeners.delete(onPromptChange);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installPwa = async () => {
    if (!globalDeferredPrompt) {
      return false;
    }

    try {
      await globalDeferredPrompt.prompt();
      const choice = await globalDeferredPrompt.userChoice;

      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
      }
      globalDeferredPrompt = null;
      setDeferredPrompt(null);
      promptListeners.forEach((fn) => fn());
      return choice.outcome === 'accepted';
    } catch (err) {
      console.warn('[REZO360 PWA] Installation annulée ou rejetée:', err);
      return false;
    }
  };

  return {
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    installPwa,
  };
}

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
