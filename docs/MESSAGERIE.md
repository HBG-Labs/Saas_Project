# Messagerie — configuration

Deux messageries distinctes cohabitent, et on les confond souvent. Elles n'ont ni le même
émetteur, ni le même endroit de réglage.

| | Qui envoie | Où cela se règle |
|---|---|---|
| **Invitations à rejoindre une entreprise** | notre Edge Function `send-invitation` | secrets Supabase |
| **Confirmation d'inscription, mot de passe oublié, changement d'adresse** | Supabase Auth | tableau de bord, réglages SMTP |

Les deux passent par le même compte Infomaniak. Configurer l'une ne configure pas l'autre.

---

## Le transport : pourquoi SMTP Infomaniak, et pas autre chose

`rezo360.fr` publie ce SPF :

```
v=spf1 include:spf.infomaniak.ch -all
```

Le `-all` est un **rejet strict** : tout serveur qui n'appartient pas à Infomaniak verra ses
messages refusés par le destinataire. Le code accepte aussi Resend — voir le commentaire de
[`send-invitation/index.ts`](../supabase/functions/send-invitation/index.ts) — mais l'employer
imposerait de modifier le SPF et d'ajouter DKIM. Avec Infomaniak, le DNS en place suffit.

On s'authentifie sur la **boîte réelle** `contact@rezo360.fr` et l'on émet **au nom de** l'alias
`noreply@rezo360.fr`. Un alias ne peut pas s'authentifier ; il peut servir d'expéditeur.

---

## 1. Secrets des Edge Functions

`Project Settings → Edge Functions → Secrets`

| Secret | Valeur |
|---|---|
| `SMTP_HOST` | `mail.infomaniak.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `contact@rezo360.fr` |
| `SMTP_PASSWORD` | mot de passe de cette boîte |
| `INVITATION_FROM_EMAIL` | `REZO360 <noreply@rezo360.fr>` |
| `APP_URL` | l'URL publique de l'application, sans barre oblique finale |

**Le port n'est pas un détail.** Le code en déduit le mode de chiffrement :
`tls: port === 465`. En 465, TLS d'emblée ; en 587, connexion en clair puis STARTTLS. Se tromper
produit une négociation qui échoue sans message clair.

**`APP_URL` sert deux fois** : construire le lien d'invitation, et servir de repli aux adresses de
retour Stripe lorsqu'aucune origine n'accompagne la requête
([`_shared/billing.ts`](../supabase/functions/_shared/billing.ts)).

---

## 2. Courriels d'authentification

`Authentication → Emails → SMTP Settings` — mêmes hôte, port et identifiants qu'au-dessus.
Expéditeur `noreply@rezo360.fr`, nom affiché `REZO360`.

Sans cela, Supabase envoie depuis son propre service, **fortement limité en débit** : c'est ce qui
a bloqué la confirmation d'un compte de test.

Puis `Authentication → URL Configuration` : *Site URL* et *Redirect URLs* alignées sur l'URL
publique. Sinon les liens de confirmation renvoient vers `localhost` — l'inscription paraît
fonctionner et personne ne peut se connecter.

### Gabarits, à coller dans `Authentication → Emails`

Ils reprennent la mise en forme du courriel d'invitation : même largeur, mêmes couleurs, même
hiérarchie. `{{ .ConfirmationURL }}` est remplacé par Supabase.

#### Confirmation d'inscription — objet : `Confirmez votre adresse — REZO360`

```html
<table role="presentation" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#0f172a">
  <tr><td style="padding:28px 28px 8px">
    <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#2563eb">REZO360</p>
    <h1 style="margin:12px 0 0;font-size:20px;line-height:1.35">Confirmez votre adresse</h1>
  </td></tr>
  <tr><td style="padding:12px 28px 0;font-size:14px;line-height:1.6;color:#334155">
    <p style="margin:0 0 16px">Un compte vient d'être créé avec cette adresse. Confirmez-la pour y accéder.</p>
  </td></tr>
  <tr><td style="padding:20px 28px">
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:8px">Confirmer mon adresse</a>
  </td></tr>
  <tr><td style="padding:0 28px 24px;font-size:12px;line-height:1.6;color:#64748b">
    <p style="margin:0">Si vous n'êtes pas à l'origine de cette inscription, ignorez ce message : sans confirmation, le compte reste inutilisable.</p>
  </td></tr>
</table>
```

#### Mot de passe oublié — objet : `Réinitialiser votre mot de passe — REZO360`

Même structure, en remplaçant le titre et le corps :

```html
    <h1 style="margin:12px 0 0;font-size:20px;line-height:1.35">Réinitialiser votre mot de passe</h1>
...
    <p style="margin:0 0 16px">Vous avez demandé un nouveau mot de passe. Ce lien est valable une heure et ne sert qu'une fois.</p>
...
    <a href="{{ .ConfirmationURL }}" ...>Choisir un nouveau mot de passe</a>
...
    <p style="margin:0">Si vous n'avez rien demandé, ignorez ce message : votre mot de passe actuel reste valable.</p>
```

#### Changement d'adresse — objet : `Confirmez votre nouvelle adresse — REZO360`

```html
    <h1 style="margin:12px 0 0;font-size:20px;line-height:1.35">Confirmez votre nouvelle adresse</h1>
...
    <p style="margin:0 0 16px">Cette adresse deviendra celle de votre compte REZO360. Elle servira à vous connecter.</p>
...
    <a href="{{ .ConfirmationURL }}" ...>Confirmer le changement</a>
...
    <p style="margin:0">Tant que ce lien n'est pas suivi, votre ancienne adresse reste active.</p>
```

---

## 3. Vérifier

```bash
node scripts/verify-email.mjs vous@exemple.fr
```

Le script crée une invitation réelle, demande son envoi, lit la réponse, puis **retire
l'invitation** — y compris en cas d'échec, pour ne pas fausser le décompte des sièges.

Tant qu'un secret manque, il affiche le motif exact plutôt qu'un silence :

```
ECHEC La fonction accepte la demande — HTTP 500 —
      Envoi non configuré. Définissez INVITATION_FROM_EMAIL, APP_URL, et soit
      SMTP_HOST/SMTP_USER/SMTP_PASSWORD, soit RESEND_API_KEY.
```

**Ce que le script ne peut pas faire** : lire votre boîte. « Le serveur a accepté le message »
n'est pas « le message est arrivé ». La dernière étape reste manuelle — inviter une adresse réelle
depuis **Techniciens**, et vérifier que le message arrive en boîte de réception, expédié par
REZO360, avec un lien cliquable.

---

## Deux conséquences à connaître

**Un envoi qui échoue ne bloque pas l'invitation.** Elle existe en base, et l'écran affiche le
lien à transmettre de vive voix. C'est délibéré : faire disparaître une invitation parce qu'un
serveur de messagerie a hoqueté serait le pire des deux mondes.

**Une invitation acceptée rend le membre facturable.** Il passe en `active`, et s'il dépasse les
sièges inclus, le supplément part au prorata sur la facture suivante. C'est la règle habituelle —
mais ce sera la première fois qu'un courriel la déclenche.
