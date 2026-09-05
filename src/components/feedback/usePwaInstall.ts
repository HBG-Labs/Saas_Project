import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    globalDeferredPrompt = event as BeforeInstallPromptEvent;
    promptListeners.forEach((listener) => listener());
  });

  window.addEventListener('appinstalled', () => {
    globalDeferredPrompt = null;
    promptListeners.forEach((listener) => listener());
  });
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => globalDeferredPrompt,
  );
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    try {
      return (
        typeof window !== 'undefined' &&
        window.matchMedia('(display-mode: standalone)').matches
      );
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const onPromptChange = () => setDeferredPrompt(globalDeferredPrompt);
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    promptListeners.add(onPromptChange);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      promptListeners.delete(onPromptChange);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installPwa = async () => {
    if (!globalDeferredPrompt) return false;

    try {
      await globalDeferredPrompt.prompt();
      const choice = await globalDeferredPrompt.userChoice;

      if (choice.outcome === 'accepted') setIsInstalled(true);
      globalDeferredPrompt = null;
      setDeferredPrompt(null);
      promptListeners.forEach((listener) => listener());
      return choice.outcome === 'accepted';
    } catch (error) {
      console.warn('[REZO360 PWA] Installation annulée ou rejetée:', error);
      return false;
    }
  };

  return {
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    installPwa,
  };
}
