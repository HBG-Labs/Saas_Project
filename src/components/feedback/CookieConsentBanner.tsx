import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Switch } from '@/components/ui/Switch';
import { ROUTES } from '@/config/routes';
import {
  acceptAllCookies,
  getCookieConsent,
  refuseAllCookies,
  setCookiePreferences,
  subscribeCookieConsent,
  subscribeCookiePreferencesRequest,
} from '@/lib/cookie-consent';

/**
 * Bandeau de consentement cookies.
 *
 * Aucun outil de mesure d'audience ni publicitaire n'est branché aujourd'hui
 * — les deux interrupteurs ci-dessous ne conditionnent donc rien de réel pour
 * l'instant. Ils sont prêts pour le jour où un outil d'analytics est ajouté :
 * son chargement se branchera alors sur `hasAnalyticsConsent()`
 * (`@/lib/cookie-consent`), sans redemander le consentement de ceux qui
 * l'ont déjà donné.
 */
export function CookieConsentBanner() {
  const [consent, setConsent] = useState(() => getCookieConsent());
  const [customizing, setCustomizing] = useState(false);
  const [draftAnalytics, setDraftAnalytics] = useState(false);
  const [draftMarketing, setDraftMarketing] = useState(false);

  useEffect(() => subscribeCookieConsent(() => setConsent(getCookieConsent())), []);

  useEffect(
    () =>
      subscribeCookiePreferencesRequest(() => {
        const current = getCookieConsent();
        setDraftAnalytics(current?.analytics ?? false);
        setDraftMarketing(current?.marketing ?? false);
        setCustomizing(true);
      }),
    [],
  );

  const openCustomize = () => {
    setDraftAnalytics(consent?.analytics ?? false);
    setDraftMarketing(consent?.marketing ?? false);
    setCustomizing(true);
  };

  const save = () => {
    setCookiePreferences({ analytics: draftAnalytics, marketing: draftMarketing });
    setCustomizing(false);
  };

  return (
    <>
      {consent === null ? (
        <div
          role="dialog"
          aria-label="Préférences de cookies"
          className="border-border bg-surface-raised shadow-modal safe-bottom fixed inset-x-0 bottom-0 z-40 border-t p-4 sm:p-5"
        >
          <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground text-xs leading-relaxed sm:max-w-xl">
              Nous utilisons des cookies pour mesurer l’audience du site. Vous pouvez tout
              accepter, tout refuser, ou choisir précisément. Détails dans notre{' '}
              <a href={ROUTES.cookies} className="text-primary hover:underline">
                politique de cookies
              </a>
              .
            </p>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={openCustomize}>
                Personnaliser
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={refuseAllCookies}>
                Tout refuser
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={acceptAllCookies}>
                Tout accepter
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Modal
        open={customizing}
        onOpenChange={setCustomizing}
        title="Personnaliser mes cookies"
        description="Choisissez les cookies que vous acceptez. Modifiable à tout moment depuis la page /cookies."
        footer={
          <Button type="button" variant="primary" onClick={save}>
            Enregistrer mes choix
          </Button>
        }
      >
        <div className="space-y-4">
          <Switch
            label="Nécessaires"
            description="Toujours actifs — ils permettent au site de fonctionner. Pas de choix possible."
            checked
            disabled
          />
          <Switch
            label="Mesure d’audience"
            description="Aucun outil de ce type n’est actif aujourd’hui sur REZO360."
            checked={draftAnalytics}
            onCheckedChange={setDraftAnalytics}
          />
          <Switch
            label="Publicité et réseaux sociaux"
            description="Aucun outil de ce type n’est actif aujourd’hui sur REZO360."
            checked={draftMarketing}
            onCheckedChange={setDraftMarketing}
          />
        </div>
      </Modal>
    </>
  );
}
