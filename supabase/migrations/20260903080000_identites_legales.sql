-- =============================================================================
-- Identités légales — émetteur et destinataire
-- =============================================================================
--
-- CE QUI MANQUE POUR QU'UNE FACTURE SOIT VALIDE
--
-- La norme EN 16931 et le code de commerce exigent des mentions que le schéma
-- ne portait nulle part : forme juridique, capital social, ville du greffe,
-- code APE, régime de TVA, coordonnées bancaires. Sans elles, aucun XML ne
-- passera un contrôle, et aucune facture papier n'est complète.
--
-- POURQUOI IL N'Y A PAS DE COLONNE `siren`
--
-- Le plan initial en prévoyait une, distincte du SIRET. C'est une erreur : le
-- SIREN est les NEUF PREMIERS CHIFFRES du SIRET, rien d'autre. Deux colonnes,
-- c'est deux sources de vérité qui divergeront — un SIRET corrigé sans que le
-- SIREN suive, et plus rien ne dit lequel fait foi.
--
-- `registration_number` reste donc l'unique identifiant : quatorze chiffres
-- pour un SIRET, neuf pour un SIREN seul (cas d'une entreprise étrangère ou
-- d'une saisie partielle). Le SIREN se DÉDUIT quand il est demandé, il ne se
-- stocke pas.
--
-- POURQUOI LE FORMAT N'EST PAS CONTRAINT ICI
--
-- Aucun `check` sur la longueur ni sur la clé de Luhn du SIRET. Ces règles
-- appartiennent au droit, elles évoluent, et elles dépendent du CAS : une
-- entreprise étrangère n'a pas de SIRET, un particulier n'en a jamais eu. Les
-- figer en contrainte imposerait une migration à chaque évolution et
-- empêcherait d'enregistrer un client parfaitement légitime.
--
-- Elles vivront dans la couche de validation, qui sait de quelle transaction
-- il s'agit — et qui bloque l'ÉMISSION plutôt que la SAISIE.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'customer_type') then
    -- `public_body` n'est pas une coquetterie : la facturation à une
    -- administration passe par un circuit distinct, avec ses propres mentions
    -- obligatoires. Ne pas pouvoir distinguer ce cas interdirait de le traiter
    -- un jour sans reprendre toutes les fiches.
    create type public.customer_type as enum ('company', 'individual', 'public_body');
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- Le destinataire
-- -----------------------------------------------------------------------------
--
-- NULLABLE, ET SANS VALEUR PAR DÉFAUT.
--
-- Poser `'company'` par défaut ferait dire au schéma que toutes les fiches
-- existantes désignent des entreprises — ce que personne n'a vérifié. Un
-- artisan facture aussi des particuliers, et un particulier n'a pas de SIRET :
-- la validation réclamerait alors un numéro qui n'existe pas.
--
-- `null` dit la vérité : on ne sait pas encore. La check-list le signalera, et
-- l'utilisateur tranchera.
alter table public.customers
  add column if not exists customer_type public.customer_type;

comment on column public.customers.customer_type is
  'Entreprise, particulier ou organisme public. NULL = non renseigne : la validation le reclame avant emission, la saisie ne le bloque pas.';

-- -----------------------------------------------------------------------------
-- L'émetteur
-- -----------------------------------------------------------------------------
alter table public.organizations
  add column if not exists legal_form          text,
  add column if not exists ape_code            text,
  add column if not exists share_capital_cents integer check (share_capital_cents is null or share_capital_cents >= 0),
  add column if not exists rcs_city            text,
  add column if not exists iban                text,
  add column if not exists bic                 text,
  add column if not exists vat_regime          text
    check (vat_regime is null or vat_regime in ('franchise', 'reel_simplifie', 'reel_normal'));

comment on column public.organizations.legal_form is 'SARL, SAS, EI, auto-entrepreneur...';
comment on column public.organizations.ape_code is 'Code APE/NAF, par exemple 4321A.';
comment on column public.organizations.share_capital_cents is
  'Capital social en centimes. NULL pour les formes qui n''en ont pas (EI, micro-entreprise).';
comment on column public.organizations.rcs_city is 'Ville du greffe d''immatriculation.';
comment on column public.organizations.vat_regime is
  'franchise (art. 293 B du CGI) | reel_simplifie | reel_normal. Decide de la mention de TVA a porter sur la facture.';

-- Les conditions de règlement des devis servent aussi aux factures : un artisan
-- qui a écrit « Paiement à 30 jours » une fois ne veut pas le ressaisir. Le nom
-- des colonnes date d'avant les factures ; le renommer casserait le code qui
-- les lit pour un gain purement cosmétique.
comment on column public.organizations.quote_payment_terms is
  'Conditions de reglement par defaut, reprises sur les devis ET les factures.';
comment on column public.organizations.quote_payment_method is
  'Moyens de paiement par defaut, repris sur les devis ET les factures.';

-- -----------------------------------------------------------------------------
-- L'instantané de l'émetteur sur la facture
-- -----------------------------------------------------------------------------
--
-- La migration précédente recopiait le destinataire mais pas l'émetteur, faute
-- des champs ci-dessus : les figer alors serait revenu à figer des trous.
-- Ils existent, on peut donc les geler.
--
-- POURQUOI RECOPIER CE QUI NE CHANGE PRESQUE JAMAIS
--
-- Presque jamais n'est pas jamais. Une entreprise déménage, change de forme
-- juridique, ouvre un nouveau compte bancaire. Une facture émise doit continuer
-- d'énoncer ce qui était vrai ce jour-là — c'est ce qui la rend opposable, et
-- ce que réclame un contrôle. Lire l'organisation en direct ferait mentir
-- rétroactivement toutes les factures passées au premier changement d'adresse.
--
-- Le trigger d'immuabilité les gèle sans qu'on ait à l'y aider : il compare la
-- ligne entière moins les colonnes explicitement modifiables. C'est exactement
-- l'intérêt de ce sens de lecture.
alter table public.invoices
  add column if not exists seller_name                text,
  add column if not exists seller_legal_name          text,
  add column if not exists seller_registration_number text,
  add column if not exists seller_vat_number          text,
  add column if not exists seller_legal_form          text,
  add column if not exists seller_ape_code            text,
  add column if not exists seller_share_capital_cents integer,
  add column if not exists seller_rcs_city            text,
  add column if not exists seller_address_line1       text,
  add column if not exists seller_address_line2       text,
  add column if not exists seller_postal_code         text,
  add column if not exists seller_city                text,
  add column if not exists seller_country             text,
  add column if not exists seller_iban                text,
  add column if not exists seller_bic                 text,
  add column if not exists seller_vat_regime          text;

-- -----------------------------------------------------------------------------
-- Le gel automatique de l'émetteur
-- -----------------------------------------------------------------------------
--
-- L'instantané est posé PAR LA BASE au moment où la facture quitte l'état de
-- brouillon, et non par l'application.
--
-- Le faire côté client supposerait que tous les chemins d'émission pensent à
-- le faire — celui d'aujourd'hui, celui qu'on écrira pour la transmission
-- électronique, celui d'un import. Le premier qui l'oublie produit une facture
-- sans émetteur, et rien ne le signale : les colonnes restent nulles, le
-- document s'affiche avec des blancs.
--
-- Ici, la règle est au seul endroit qu'aucun chemin ne contourne.
create or replace function app.freeze_invoice_seller()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org public.organizations%rowtype;
begin
  -- Seulement au passage de brouillon à autre chose, et seulement si
  -- l'instantané n'existe pas déjà : réémettre ne réécrit rien.
  if old.status <> 'draft' or new.status = 'draft' or new.seller_name is not null then
    return new;
  end if;

  select * into v_org from public.organizations o where o.id = new.organization_id;

  if v_org.id is null then
    raise exception 'Organisation introuvable pour la facture %.', new.reference
      using errcode = 'foreign_key_violation';
  end if;

  new.seller_name                := v_org.name;
  new.seller_legal_name          := v_org.legal_name;
  new.seller_registration_number := v_org.registration_number;
  new.seller_vat_number          := v_org.vat_number;
  new.seller_legal_form          := v_org.legal_form;
  new.seller_ape_code            := v_org.ape_code;
  new.seller_share_capital_cents := v_org.share_capital_cents;
  new.seller_rcs_city            := v_org.rcs_city;
  new.seller_address_line1       := v_org.address_line1;
  new.seller_address_line2       := v_org.address_line2;
  new.seller_postal_code         := v_org.postal_code;
  new.seller_city                := v_org.city;
  new.seller_country             := v_org.country;
  new.seller_iban                := v_org.iban;
  new.seller_bic                 := v_org.bic;
  new.seller_vat_regime          := v_org.vat_regime;

  return new;
end;
$$;

-- L'ORDRE DES TRIGGERS COMPTE, ET IL EST ALPHABETIQUE.
--
-- PostgreSQL exécute les triggers `before update` par ordre alphabétique de
-- nom. `invoices_freeze_seller` passe donc AVANT `invoices_immutable` — c'est
-- indispensable : l'immuabilité compare la ligne entière, et verrait ces
-- écritures comme une modification interdite si elle s'exécutait la première.
--
-- Le nom n'est pas décoratif : le renommer en `invoices_zz_...` casserait le
-- gel de l'émetteur sans qu'aucun test de compilation ne s'en aperçoive.
drop trigger if exists invoices_freeze_seller on public.invoices;
create trigger invoices_freeze_seller
  before update on public.invoices
  for each row execute function app.freeze_invoice_seller();

-- -----------------------------------------------------------------------------
-- Garde-fou
-- -----------------------------------------------------------------------------
do $$
declare
  v_manquantes text;
begin
  select string_agg(c.attendue, ', ')
    into v_manquantes
  from (values
    ('organizations', 'legal_form'), ('organizations', 'ape_code'),
    ('organizations', 'share_capital_cents'), ('organizations', 'rcs_city'),
    ('organizations', 'iban'), ('organizations', 'bic'),
    ('organizations', 'vat_regime'),
    ('customers', 'customer_type'),
    ('invoices', 'seller_name'), ('invoices', 'seller_registration_number'),
    ('invoices', 'seller_iban'), ('invoices', 'seller_vat_regime')
  ) as c(tbl, attendue)
  where not exists (
    select 1 from information_schema.columns ic
    where ic.table_schema = 'public' and ic.table_name = c.tbl and ic.column_name = c.attendue
  );

  if v_manquantes is not null then
    raise exception 'Colonnes absentes apres migration : %', v_manquantes;
  end if;

  -- Le trigger doit precéder `invoices_immutable` dans l'ordre alphabetique,
  -- sans quoi le gel de l'emetteur serait refuse par l'immuabilite elle-meme.
  if 'invoices_freeze_seller' >= 'invoices_immutable' then
    raise exception
      'invoices_freeze_seller doit preceder invoices_immutable dans l''ordre alphabetique.';
  end if;
end
$$;
