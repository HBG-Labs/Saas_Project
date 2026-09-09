import { Button } from '@/components/ui/Button';
import { DEPOTS_LOCAUX, EDITEUR, TRACEURS_TIERS } from '@/config/legal';
import { requestCookiePreferences } from '@/lib/cookie-consent';
import { useDocumentTitle } from '@/lib/use-document-title';

/**
 * Politique de cookies.
 *
 * Vaut pour l'ensemble du site — le produit REZO360 comme l'activité de
 * prestations de HBG Labs, un seul et même site.
 *
 * L'ÉTAT DÉCRIT EST L'ÉTAT RÉEL DU CODE, PAS UNE INTENTION
 *
 * Un bandeau de consentement (`CookieConsentBanner`, monté globalement dans
 * `app/providers.tsx`) est en place PAR PRÉCAUTION : aucun outil de mesure
 * d'audience ni publicitaire n'existe aujourd'hui — vérifié directement dans
 * le code, pas supposé — donc les catégories « Mesure d'audience » et
 * « Publicité » qu'il propose ne conditionnent rien de réel pour l'instant.
 * Le tableau des dépôts locaux vient de `config/legal.ts`, la même source que
 * le reste des pages légales.
 *
 * ⚠️ CE QUI CHANGE LE JOUR OÙ UN OUTIL DE MESURE OU UN PIXEL PUBLICITAIRE EST
 * AJOUTÉ : brancher son chargement sur `hasAnalyticsConsent()` /
 * `hasMarketingConsent()` (`@/lib/cookie-consent`) AVANT de l'activer — pas
 * après coup — pour que le consentement déjà recueilli reste valable.
 *
 * ⚠️ Rédigé par un ingénieur d'après le fonctionnement réel du produit, non par
 * un juriste. À relire avant l'ouverture commerciale.
 */
export default function CookiePolicyPage() {
  useDocumentTitle('Politique de cookies');

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
        Politique de cookies
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Ce que le site dépose sur votre navigateur, et ce à quoi votre consentement sert
        vraiment.
      </p>

      <Section titre="Un traceur publicitaire, et seulement si vous l’acceptez">
        <p className="text-muted-foreground text-sm leading-relaxed">
          Nous utilisons le pixel Meta pour savoir lesquelles de nos publicités amènent réellement
          des inscriptions. C’est le seul traceur tiers du site, et il n’est{' '}
          <strong className="text-foreground">pas chargé du tout</strong> tant que vous n’avez pas
          accepté la catégorie « marketing ». Le refuser ne dégrade rien : le site fonctionne à
          l’identique.
        </p>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          Aucun cookie de mesure d’audience n’est déposé par ailleurs.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[38rem] text-left text-sm">
            <thead>
              <tr className="text-subtle-foreground text-xs">
                <th className="py-2 pr-3 font-medium">Traceur</th>
                <th className="py-2 pr-3 font-medium">Finalité</th>
                <th className="py-2 pr-3 font-medium">Destinataire</th>
                <th className="py-2 font-medium">Durée</th>
              </tr>
            </thead>
            <tbody>
              {TRACEURS_TIERS.map((t) => (
                <tr key={t.nom} className="border-border border-t align-top">
                  <td className="text-foreground py-2 pr-3 font-medium">{t.nom}</td>
                  <td className="text-muted-foreground py-2 pr-3">{t.finalite}</td>
                  <td className="text-muted-foreground py-2 pr-3">{t.destinataire}</td>
                  <td className="text-muted-foreground py-2 text-xs whitespace-nowrap">
                    {t.duree}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          Meta est établie en Irlande et traite ces données aux États-Unis. Ce transfert s’appuie
          sur la décision d’adéquation « EU-US Data Privacy Framework » adoptée par la Commission
          européenne le 10 juillet 2023.
        </p>
      </Section>

      <Section titre="Ce que votre navigateur conserve localement">
        <p className="text-muted-foreground text-sm leading-relaxed">
          Techniquement, il ne s’agit pas de cookies au sens strict mais de stockage local du
          navigateur (<code className="text-foreground text-xs">localStorage</code>) — la
          distinction n’a pas d’incidence sur vos droits, elle est signalée par souci d’exactitude.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead>
              <tr className="text-subtle-foreground text-xs">
                <th className="py-2 pr-3 font-medium">Donnée conservée</th>
                <th className="py-2 pr-3 font-medium">Finalité</th>
                <th className="py-2 font-medium">Durée</th>
              </tr>
            </thead>
            <tbody>
              {DEPOTS_LOCAUX.map((d) => (
                <tr key={d.nom} className="border-border border-t align-top">
                  <td className="text-foreground py-2 pr-3 font-medium">{d.nom}</td>
                  <td className="text-muted-foreground py-2 pr-3">{d.finalite}</td>
                  <td className="text-muted-foreground py-2 text-xs whitespace-nowrap">{d.duree}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section titre="Pourquoi ce bandeau vous est présenté">
        <p className="text-muted-foreground text-sm leading-relaxed">
          La réglementation (article 82 de la loi Informatique et Libertés, recommandation « Cookies
          et autres traceurs » de la CNIL) impose de recueillir votre consentement pour les cookies
          qui ne sont pas strictement nécessaires au service — publicité, mesure d’audience non
          exemptée, partage sur les réseaux sociaux. Le pixel Meta décrit plus haut entre dans ce
          cadre : d’où le bandeau.
        </p>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          Trois choix vous sont offerts, aussi simples les uns que les autres —{' '}
          <strong className="text-foreground">tout accepter</strong>,{' '}
          <strong className="text-foreground">tout refuser</strong>, ou{' '}
          <strong className="text-foreground">personnaliser</strong>. Refuser est un clic, comme
          accepter. Tant que vous n’avez pas accepté la catégorie « marketing », le script de Meta
          n’est pas téléchargé : il ne s’agit pas de le charger puis de le laisser inactif, mais de
          ne pas l’appeler du tout — car un script chargé dépose ses cookies avant même d’avoir
          servi.
        </p>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          Les dépôts locaux listés plus haut, eux, ne demandent pas votre accord : ils sont
          strictement nécessaires au fonctionnement du site ou relèvent d’une préférence que vous
          avez vous-même choisie.
        </p>
      </Section>

      <Section titre="Vos choix">
        <p className="text-muted-foreground text-sm leading-relaxed">
          Vous pouvez revoir ou modifier votre choix à tout moment.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => requestCookiePreferences()}
          className="mt-3"
        >
          Gérer mes préférences de cookies
        </Button>
        <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
          Vous pouvez aussi vider le stockage local depuis les réglages de votre navigateur — cela
          vous déconnectera et réinitialisera vos préférences d’affichage. Pour toute question :{' '}
          <a href={`mailto:${EDITEUR.email}`} className="text-primary hover:underline">
            {EDITEUR.email}
          </a>
          .
        </p>
      </Section>
    </div>
  );
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-foreground text-lg font-semibold">{titre}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
