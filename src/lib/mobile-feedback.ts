import { Capacitor, registerPlugin } from '@capacitor/core';

interface NativeHapticsPlugin {
  impact(options: { style: 'LIGHT' }): Promise<void>;
  notification(options: { type: 'SUCCESS' }): Promise<void>;
}

// Le fallback Web est volontairement un no-op : inutile de livrer l'implémentation
// Web du plugin quand seul le pont natif Android/iOS est utilisé.
const NativeHaptics = registerPlugin<NativeHapticsPlugin>('Haptics');

/** Retour très léger, uniquement après une action explicite de l'utilisateur. */
export function selectionFeedback(): void {
  if (!Capacitor.isNativePlatform()) return;
  void NativeHaptics.impact({ style: 'LIGHT' }).catch(() => undefined);
}

export function successFeedback(): void {
  if (!Capacitor.isNativePlatform()) return;
  void NativeHaptics.notification({ type: 'SUCCESS' }).catch(() => undefined);
}
