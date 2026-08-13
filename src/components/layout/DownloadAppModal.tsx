import {
  Apple,
  CheckCircle2,
  Download,
  QrCode,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';

interface DownloadAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DownloadAppModal({ isOpen, onClose }: DownloadAppModalProps) {
  const [downloadingTarget, setDownloadingTarget] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownload = (type: 'apk' | 'ios') => {
    setDownloadingTarget(type);
    setDownloadSuccess(null);

    // Simulation de téléchargement de l'application mobile
    setTimeout(() => {
      const element = document.createElement('a');
      let filename = '';
      let message = '';

      if (type === 'apk') {
        filename = 'NexoraTech-Mobile-Android-v2.4.apk';
        message = 'Téléchargement de NexoraTech Mobile pour Android (.APK) démarré !';
      } else {
        filename = 'NexoraTech-iOS-Enterprise-v2.4.mobileconfig';
        message = 'Profil d’installation iOS (iPhone/iPad) téléchargé !';
      }

      const fileContent = `PACKAGE INSTALLATEUR MOBILE NEXORATECH ${type.toUpperCase()}\nVersion: 2.4.0-release\nOrg ID: org-demo\nTimestamp: ${new Date().toISOString()}`;
      
      const file = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
      element.href = URL.createObjectURL(file);
      element.download = filename;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);

      setDownloadingTarget(null);
      setDownloadSuccess(message);

      setTimeout(() => setDownloadSuccess(null), 6000);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-sunken backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-surface text-foreground shadow-2xl animate-in zoom-in-95 duration-200">
        
        {/* Glow de fond */}
        <div className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 size-96 rounded-full bg-blue-500/10 blur-3xl" />

        {/* Header de la Modale */}
        <div className="flex items-center justify-between border-b border-border p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10 text-primary border border-blue-500/20">
              <Smartphone className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                Télécharger l'Application Mobile NexoraTech
                <span className="text-2xs font-mono font-medium text-muted-foreground border-l border-border-strong pl-2">
                  v2.4.0
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Vos interventions, outils de calculs et normes techniques directement sur votre smartphone (Android & iOS).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-raised hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Message de succès */}
        {downloadSuccess ? (
          <div className="mx-6 mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
            <CheckCircle2 className="size-4 shrink-0" />
            {downloadSuccess}
          </div>
        ) : null}

        {/* Contenu principal : 2 Plateformes Mobiles (Android & iOS) */}
        <div className="p-6 space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* 1. Android Card */}
            <div className="relative overflow-hidden rounded-xl border border-border bg-surface-sunken p-5 flex flex-col justify-between hover:border-emerald-500/40 transition-all">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <Smartphone className="size-5" />
                  </span>
                  <span className="text-2xs font-semibold text-emerald-600 dark:text-emerald-400">
                    Android (Google)
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-base">Android (.APK)</h3>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    Package d'installation direct APK. Suivi d'interventions, outils de calculs métier et rapports terrain.
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full gap-2 shadow-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white h-10"
                  onClick={() => handleDownload('apk')}
                  disabled={downloadingTarget !== null}
                >
                  <Download className="size-4" />
                  {downloadingTarget === 'apk' ? 'Chargement APK…' : 'Télécharger l\'APK Android (84 MB)'}
                </Button>
              </div>
            </div>

            {/* 2. iOS Apple Card */}
            <div className="relative overflow-hidden rounded-xl border border-border bg-surface-sunken p-5 flex flex-col justify-between hover:border-blue-500/40 transition-all">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10 text-primary border border-blue-500/20">
                    <Apple className="size-5" />
                  </span>
                  <span className="text-2xs font-semibold text-primary">
                    iOS / iPadOS (Apple)
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-base">Apple iOS (iPhone / iPad)</h3>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    Application officielle pour iPhone et iPad. Outils de calculs normés, gestion des missions et synchro cloud.
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full gap-2 shadow-sm font-bold bg-blue-600 hover:bg-blue-500 text-white h-10"
                  onClick={() => handleDownload('ios')}
                  disabled={downloadingTarget !== null}
                >
                  <Download className="size-4" />
                  {downloadingTarget === 'ios' ? 'Chargement iOS…' : 'Installer sur iPhone / iOS'}
                </Button>
              </div>
            </div>

          </div>

          {/* Section QR Code d'installation rapide sur Smartphone */}
          <div className="rounded-xl border border-border bg-surface-sunken p-4 flex flex-col sm:flex-row items-center gap-4">
            <div className="flex size-24 items-center justify-center rounded-xl border border-blue-500/30 bg-surface p-2 shrink-0">
              <svg viewBox="0 0 100 100" className="size-full text-primary fill-current">
                <rect x="10" y="10" width="25" height="25" rx="4" />
                <rect x="65" y="10" width="25" height="25" rx="4" />
                <rect x="10" y="65" width="25" height="25" rx="4" />
                <rect x="16" y="16" width="13" height="13" fill="#0284c7" />
                <rect x="71" y="16" width="13" height="13" fill="#0284c7" />
                <rect x="16" y="71" width="13" height="13" fill="#0284c7" />
                <rect x="42" y="10" width="15" height="15" />
                <rect x="42" y="32" width="15" height="35" />
                <rect x="65" y="42" width="25" height="15" />
                <rect x="42" y="75" width="48" height="15" />
              </svg>
            </div>

            <div className="flex-1 space-y-1 text-center sm:text-left">
              <h4 className="text-xs font-bold text-foreground flex items-center justify-center sm:justify-start gap-1.5">
                <QrCode className="size-3.5 text-primary" />
                Scannez avec un iPhone ou Android pour installer l'application
              </h4>
              <p className="text-2xs text-muted-foreground leading-relaxed">
                Le QR Code redirige automatiquement vers le bon Store mobile (Google Play Store sur Android, Apple App Store sur iOS).
              </p>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border bg-surface-sunken px-6 py-3.5 text-2xs text-subtle-foreground">
          <span className="flex items-center gap-1">
            <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            Certifié Google Play Protect & Apple Enterprise Signed
          </span>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Fermer
          </Button>
        </div>

      </div>
    </div>
  );
}
