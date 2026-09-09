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
 * ─────────────────────────────────────────────────────────────────────────────
 * « PUBLICITÉ » GOUVERNE MAINTENANT UN VRAI TRACEUR
 *
 * L'interrupteur « Publicité et réseaux sociaux » décide du chargement du pixel
 * Meta (`@/lib/meta-pixel`). Tant qu'il est fermé, `fbevents.js` n'est PAS
 * téléchargé — ce qui est différent de le charger puis de le laisser inactif,
 * un script chargé déposant ses cookies avant tout événement.
 *
 * « Mesure d'audience » ne gouverne encore rien : aucun outil d'analytics n'est
 * branché. L'interrupteur reste en place pour que le choix déjà exprimé ne soit
 * pas reperdu le jour où l'un est ajouté — son chargement se branchera alors
 * sur `hasAnalyticsConsent()`.
 *
 * Les libellés doivent rester exacts. Ils constituent l'information préalable
 * exigée par l'article 82 : décrire un traceur absent, ou taire un traceur
 * présent, vicie le consentement recueilli. La liste faisant foi est
 * `config/legal.ts` → `TRACEURS_TIERS`, publiée sur /cookies.
 * ─────────────────────────────────────────────────────────────────────────────
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
              Nous utilisons un traceur publicitaire pour savoir quelles annonces amènent des
              inscriptions. Vous pouvez tout accepter, tout refuser, ou choisir précisément — le
              site fonctionne à l’identique dans tous les cas. Détails dans notre{' '}
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
            description="Pixel Meta (Facebook, Instagram) — nous permet de savoir quelles publicités amènent des inscriptions. Conservation 3 mois. Désactivé, il n’est pas chargé du tout."
            checked={draftMarketing}
            onCheckedChange={setDraftMarketing}
          />
        </div>
      </Modal>
    </>
  );
}
