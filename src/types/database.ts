/**
 * Types de la base Supabase.
 *
 * Ce fichier est écrit à la main en correspondance EXACTE avec les migrations
 * de `supabase/migrations/`. Dès que le projet Supabase existe, régénérez-le
 * plutôt que de l'éditer :
 *
 *     npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ATTENTION — Ce fichier décrit uniquement le schéma `public`.
 * Les fonctions du schéma `app` (autorisation, entitlements) sont
 * DÉLIBÉRÉMENT absentes : elles ne sont pas exposées par PostgREST et ne
 * doivent jamais être appelables depuis le navigateur. Leur absence ici n'est
 * pas un oubli, c'est la traduction de la frontière de sécurité.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

// -----------------------------------------------------------------------------
// Énumérations PostgreSQL
// -----------------------------------------------------------------------------
export type ContentStatus = 'draft' | 'active' | 'archived';
export type ToolVisibility = 'public' | 'authenticated' | 'pro';

export type OrgRole = 'owner' | 'admin' | 'manager' | 'team_leader' | 'technician' | 'employee';
export type MemberStatus = 'invited' | 'active' | 'suspended' | 'removed';
export type OrganizationStatus = 'active' | 'suspended' | 'archived';
export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';

export type TeamMemberRole = 'lead' | 'member';

export type MissionStatus =
  | 'draft'
  | 'assigned'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  /** Dossier clos et facturable — distinct de `approved`, qui n'atteste que la conformité technique. */
  | 'closed';

export type MissionPriority = 'low' | 'normal' | 'high' | 'urgent';

export type InterventionStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';
export type ReportStatus = 'draft' | 'submitted' | 'approved' | 'rejected';
export type AttachmentKind = 'before' | 'after' | 'document' | 'proof' | 'signature';

/** Nature d'un segment de temps : travail effectif ou interruption. */
export type TimeEntryKind = 'work' | 'pause';

export type VehicleType = 'van' | 'truck' | 'car' | 'aerial_lift' | 'utility';
export type VehicleFuel = 'diesel' | 'essence' | 'electric' | 'hybrid';
export type VehicleStatus = 'in_service' | 'available' | 'maintenance' | 'out_of_service';
export type VehicleMaintenanceType =
  'revision' | 'controle_technique' | 'pneus' | 'freins' | 'vidange' | 'reparation' | 'autre';

export type StockMovementType = 'in' | 'out' | 'transfer' | 'adjustment';

export type PurchaseOrderStatus =
  'draft' | 'sent' | 'partially_received' | 'received' | 'cancelled';

export type EquipmentCategory = 'optique' | 'electricite' | 'radio' | 'securite' | 'autre';
export type EquipmentStatus = 'available' | 'assigned' | 'maintenance' | 'expired';
export type EquipmentCondition = 'neuf' | 'bon_etat' | 'a_reviser';

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'refused' | 'expired';
export type QuoteReminderStatus = 'pending' | 'sent' | 'skipped' | 'failed';
export type DocumentKind = 'quote' | 'invoice' | 'credit_note';
export type DocumentNumberingFormat =
  | 'day_sequence'
  | 'month_sequence'
  | 'year_sequence'
  | 'sequence_6'
  | 'sequence'
  | 'legacy_quote'
  | 'legacy_invoice';

/**
 * Cycle de vie d'une facture. `sent` dit que le document est parti chez le
 * client, PAS qu'il a été transmis à une plateforme agréée : le statut de
 * transmission électronique aura ses propres colonnes, et un document peut être
 * réglé sans jamais avoir transité par une plateforme.
 */
export type InvoiceStatus = 'draft' | 'issued' | 'sent' | 'paid' | 'cancelled';

export type InvoiceDocumentType = 'invoice' | 'credit_note';
export type PaymentMethod = 'transfer' | 'check' | 'card' | 'cash' | 'direct_debit' | 'other';
export type WorkspaceTaskStatus = 'todo' | 'in_progress' | 'done';
export type RecurringOccurrenceStatus = 'created' | 'skipped';
export type CustomerCreditOrigin = 'credit_note' | 'overpayment';
/** Temps hors intervention — 20261002090000_feuille_heures.sql */
export type WorkTimeKind = 'travel' | 'workshop' | 'training' | 'other';
/** Enregistrement vocal — 20261005090000_enregistrements_vocaux.sql */
export type WorkspaceRecordingStatus = 'uploading' | 'pending' | 'processing' | 'done' | 'failed';
/** Moteur de transcription par organisation — 20261006090000_stt_colonnes_et_flag.sql */
export type SttEngine = 'legacy' | 'v2';
/** Un remplacement de la normalisation contrôlée — 20261008090000_stt_normalisation.sql */
export interface NormalizationChange {
  /** La forme trouvée dans le brut. */
  de: string;
  /** Le terme connu qui la remplace. */
  vers: string;
  occurrences: number;
  /** « orthographe » : graphie d'un terme connu ; « modele » : mot mal entendu, dans son seul passage. */
  couche: 'orthographe' | 'modele';
  /** Couche modèle : le passage exact où le remplacement s'applique. */
  contexte?: string;
}
/** Dictionnaire de transcription — 20261007093000_organization_vocabulary.sql */
export type VocabularyType =
  'client' | 'site' | 'materiel' | 'technique' | 'personne' | 'lieu' | 'autre';
export type VocabularySource = 'auto' | 'manuel';
/** Un paragraphe horodaté d'une transcription (secondes). */
export interface RecordingSegment {
  start: number | null;
  end: number | null;
  speaker: string | null;
  text: string;
}
export type WorkspaceTaskPriority = 'low' | 'normal' | 'high';
/** Document TipTap : `{ type: 'doc', content: [...] }`. Opaque pour la base. */
export type TiptapDocument = { type: 'doc'; content?: unknown[] } & Record<string, unknown>;

export type InvoiceTransmissionStatus =
  | 'queued'
  | 'submitting'
  | 'submitted'
  | 'delivered'
  | 'accepted'
  | 'rejected'
  | 'failed'
  | 'cancelled';

export type EinvoicingConnectionStatus =
  'pending_verification' | 'connected' | 'action_required' | 'disconnected';

export type EinvoicingReceptionStatus =
  'not_requested' | 'pending_verification' | 'active' | 'failed';

/** Triage métier d'une facture reçue — seul champ modifiable côté client. */
export type ReceivedInvoiceInternalStatus = 'new' | 'viewed' | 'archived' | 'disputed';

/**
 * Nature du destinataire. `null` en base signifie « non renseigne » : la
 * validation le reclame avant emission, la saisie ne le bloque pas — un
 * particulier n'a pas de SIRET, et l'exiger interdirait de creer sa fiche.
 */
export type CustomerType = 'company' | 'individual' | 'public_body';

/** franchise (art. 293 B du CGI) | reel_simplifie | reel_normal. */
export type VatRegime = 'franchise' | 'reel_simplifie' | 'reel_normal';

/**
 * Codes de catégorie de TVA UNCL5305, repris par la norme EN 16931.
 * S standard · Z taux zéro · E exonéré · AE autoliquidation ·
 * K livraison intracommunautaire · G exportation · O hors champ.
 */
export type VatCategory = 'S' | 'Z' | 'E' | 'AE' | 'K' | 'G' | 'O';

export type AiDocumentStatus = 'pending' | 'processing' | 'ready' | 'error';

export type NoteCategory = 'technique' | 'urgent' | 'client' | 'memo';

export type LeaveType = 'paid_leave' | 'rtt' | 'sick_leave' | 'unpaid' | 'family' | 'recovery';

/**
 * `cancelled` n'est pas un refus : c'est un retrait par l'auteur. Les confondre
 * fausserait autant les soldes que l'historique social.
 */
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type RecurrenceFrequency = 'weekly' | 'monthly' | 'quarterly' | 'bi_annual' | 'yearly';

export type TechnicianPresence = 'on_road' | 'on_site' | 'available' | 'offline';

/**
 * Types de champ d'un formulaire métier.
 *
 * Sept, délibérément. `photo` et `signature` sont absents : ils supposent le
 * téléversement vers `intervention_attachments`, qui n'a jamais été exercé.
 */
export type FormFieldType =
  'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'multiselect' | 'date';

/** Parcours commercial d'un prospect (Prospect Radar, module interne). */
export type ProspectStatus =
  | 'nouveau'
  | 'a_qualifier'
  | 'a_contacter'
  | 'contacte'
  | 'a_relancer'
  | 'interesse'
  | 'essai'
  | 'converti'
  | 'refuse'
  | 'ignore'
  | 'ne_plus_contacter';

// -----------------------------------------------------------------------------
// Portail client
// -----------------------------------------------------------------------------
export type ClientConversationStatus = 'open' | 'closed';
export type ClientConversationInitiator = 'organization' | 'client';
export type ClientMessageDirection = 'outbound' | 'inbound';
export type ClientMessageChannel = 'portal' | 'email';
export type ClientMessageStatus =
  'queued' | 'sent' | 'delivered' | 'failed' | 'bounced' | 'complained' | 'received';

/** Résultat de `portal_my_context()`. */
export interface PortalContext {
  organization_id: string;
  organization_name: string;
  contact_id: string;
  contact_first_name: string | null;
  contact_last_name: string;
  contact_email: string;
  customer_id: string;
  customer_name: string;
  allow_client_initiated: boolean;
  features: {
    missions: boolean;
    interventions: boolean;
    quotes: boolean;
    invoicing: boolean;
    documents: boolean;
  };
}

/** Ligne de `portal_list_missions()`. */
export interface PortalMission {
  id: string;
  organization_id: string;
  reference: string;
  title: string;
  status: string;
  priority: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  location_label: string | null;
  address_line1: string | null;
  postal_code: string | null;
  city: string | null;
  site_name: string | null;
  has_approved_report: boolean;
  shared_attachments_count: number;
}

/** Document JSON de `portal_mission_detail(uuid)` ; `null` si invisible. */
export interface PortalMissionDetail {
  id: string;
  organization_id: string;
  reference: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  location_label: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  site_name: string | null;
  interventions: Array<{
    id: string;
    status: string;
    start_time: string | null;
    end_time: string | null;
  }>;
  /** Uniquement un rapport approuvé, sans observations internes. */
  report: {
    work_description: string | null;
    materials_used: string | null;
    submitted_at: string | null;
    customer_signature_name: string | null;
  } | null;
  /** Uniquement les pièces jointes partagées. */
  attachments: Array<{
    id: string;
    kind: string;
    file_name: string;
    mime_type: string | null;
    size_bytes: number | null;
    caption: string | null;
    storage_path: string;
    created_at: string;
  }>;
}

/** Ligne de `portal_list_quotes()` — jamais un brouillon. */
export interface PortalQuote {
  id: string;
  organization_id: string;
  reference: string;
  title: string | null;
  status: string;
  valid_until: string | null;
  created_at: string;
  subtotal_cents: number;
  vat_cents: number;
  total_cents: number;
  pdf_path: string | null;
}

/** Document JSON de `portal_quote_detail(uuid)` ; `null` si invisible. */
export interface PortalQuoteDetail {
  id: string;
  organization_id: string;
  reference: string;
  title: string | null;
  status: string;
  notes: string | null;
  valid_until: string | null;
  vat_rate: number;
  created_at: string;
  client_responded_at: string | null;
  site_name: string | null;
  subtotal_cents: number;
  vat_cents: number;
  total_cents: number;
  pdf_path: string | null;
  items: Array<{
    id: string;
    description: string;
    unit: string;
    quantity: number;
    unit_price_cents: number;
    line_total_cents: number;
  }>;
}

/** Ligne de `portal_list_invoices()` — jamais un brouillon. */
export interface PortalInvoice {
  id: string;
  organization_id: string;
  reference: string;
  document_type: string;
  title: string | null;
  status: string;
  issued_at: string | null;
  due_date: string | null;
  subtotal_cents: number;
  vat_cents: number;
  total_cents: number;
  pdf_path: string | null;
}

/** Ligne de `portal_list_documents()`. */
export interface PortalDocument {
  id: string;
  organization_id: string;
  name: string;
  category: string | null;
  mime_type: string | null;
  file_size: number | null;
  storage_path: string;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      // =======================================================================
      // Socle utilisateur
      // =======================================================================
      /**
       * Identité, visible des collègues.
       *
       * `profiles_select_visible` autorise la lecture à soi-même et à toute
       * personne partageant une organisation. Les données PERSONNELLES —
       * téléphone, habilitations — vivent dans `profile_details`, que son seul
       * titulaire peut lire.
       */
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string | null;
          avatar_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };

      /**
       * Fiche personnelle — lisible et modifiable par son seul titulaire, pas
       * même par un propriétaire d'organisation.
       */
      profile_details: {
        Row: {
          user_id: string;
          phone: string | null;
          zone: string | null;
          /** `[{ label, detail, expires_at }]` — déclaratif, jamais opposable. */
          certifications: Json;
          /** `[{ id, name, serial }]` — distinct de `equipment`, l'inventaire de l'entreprise. */
          equipments: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          phone?: string | null;
          zone?: string | null;
          certifications?: Json;
          equipments?: Json;
        };
        Update: {
          phone?: string | null;
          zone?: string | null;
          certifications?: Json;
          equipments?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'profile_details_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };

      // =======================================================================
      // Catalogue
      // =======================================================================
      categories: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          short_description: string | null;
          icon: string | null;
          sort_order: number;
          status: ContentStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description?: string | null;
          short_description?: string | null;
          icon?: string | null;
          sort_order?: number;
          status?: ContentStatus;
        };
        Update: {
          slug?: string;
          name?: string;
          description?: string | null;
          short_description?: string | null;
          icon?: string | null;
          sort_order?: number;
          status?: ContentStatus;
        };
        Relationships: [];
      };

      tools: {
        Row: {
          id: string;
          slug: string;
          category_id: string;
          name: string;
          description: string | null;
          short_description: string | null;
          keywords: string[];
          icon: string | null;
          sort_order: number;
          status: ContentStatus;
          visibility: ToolVisibility;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          category_id: string;
          name: string;
          description?: string | null;
          short_description?: string | null;
          keywords?: string[];
          icon?: string | null;
          sort_order?: number;
          status?: ContentStatus;
          visibility?: ToolVisibility;
        };
        Update: {
          slug?: string;
          category_id?: string;
          name?: string;
          description?: string | null;
          short_description?: string | null;
          keywords?: string[];
          icon?: string | null;
          sort_order?: number;
          status?: ContentStatus;
          visibility?: ToolVisibility;
        };
        Relationships: [
          {
            foreignKeyName: 'tools_category_id_fkey';
            columns: ['category_id'];
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
        ];
      };

      favorites: {
        Row: { user_id: string; tool_id: string; created_at: string };
        Insert: { user_id: string; tool_id: string; created_at?: string };
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'favorites_tool_id_fkey';
            columns: ['tool_id'];
            referencedRelation: 'tools';
            referencedColumns: ['id'];
          },
        ];
      };

      tool_history: {
        Row: { id: string; user_id: string; tool_id: string; used_at: string };
        Insert: { id?: string; user_id: string; tool_id: string; used_at?: string };
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'tool_history_tool_id_fkey';
            columns: ['tool_id'];
            referencedRelation: 'tools';
            referencedColumns: ['id'];
          },
        ];
      };

      // =======================================================================
      // RBAC
      // =======================================================================
      role_permissions: {
        Row: { role: OrgRole; permission: string };
        /** Administrée par migration : le client ne peut pas écrire. */
        Insert: never;
        Update: never;
        Relationships: [];
      };

      // =======================================================================
      // Multi-tenant
      // =======================================================================
      organizations: {
        Row: {
          id: string;
          slug: string;
          name: string;
          legal_name: string | null;
          logo_url: string | null;
          registration_number: string | null;
          vat_number: string | null;
          email: string | null;
          phone: string | null;
          address_line1: string | null;
          address_line2: string | null;
          postal_code: string | null;
          city: string | null;
          country: string | null;
          status: OrganizationStatus;
          /** Métier exercé. `null` = cœur sans spécialisation. */
          industry: string | null;
          /** Taux de TVA par défaut (%) appliqué aux devis et chiffrages. */
          default_vat_rate: number | null;
          /** Conditions de règlement affichées sur les devis. `null` = texte par défaut côté client. */
          quote_payment_terms: string | null;
          /** Moyens de paiement acceptés, affichés sur les devis. `null` = texte par défaut côté client. */
          quote_payment_method: string | null;
          /** Jours de relance d'un devis sans réponse (`{7,14}` par défaut). Vide = aucune. */
          quote_reminder_days: number[];
          legal_form: string | null;
          ape_code: string | null;
          share_capital_cents: number | null;
          rcs_city: string | null;
          iban: string | null;
          bic: string | null;
          vat_regime: VatRegime | null;
          /**
           * Territoire de référence pour les jours fériés.
           *
           * Donnée d'ENTREPRISE, pas préférence d'affichage : le décompte des
           * congés en dépend, et deux gestionnaires de la même société doivent
           * obtenir le même total.
           */
          holiday_territory: string;
          /** Cache maintenu par trigger depuis `subscriptions`. Lecture seule. */
          plan_code: string | null;
          created_by: string | null;
          /** Fuseau IANA, sert aux heures des récurrences. */
          timezone: string;
          /** Durée hebdomadaire contractuelle par défaut (35). Surchargeable par membre. */
          weekly_hours: number;
          /** Moteur de transcription vocale — 20261006090000. `legacy` = chaîne d'origine, `v2` = nouveau moteur + glossaire. */
          stt_engine: SttEngine;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          legal_name?: string | null;
          logo_url?: string | null;
          registration_number?: string | null;
          vat_number?: string | null;
          email?: string | null;
          phone?: string | null;
          address_line1?: string | null;
          address_line2?: string | null;
          postal_code?: string | null;
          city?: string | null;
          country?: string | null;
          industry?: string | null;
          default_vat_rate?: number | null;
          quote_payment_terms?: string | null;
          quote_payment_method?: string | null;
          quote_reminder_days?: number[];
          legal_form?: string | null;
          ape_code?: string | null;
          share_capital_cents?: number | null;
          rcs_city?: string | null;
          iban?: string | null;
          bic?: string | null;
          vat_regime?: VatRegime | null;
          /** Imposé à `auth.uid()` par la policy `organizations_insert_self`. */
          created_by: string;
        };
        Update: {
          timezone?: string;
          weekly_hours?: number;
          stt_engine?: SttEngine;
          name?: string;
          holiday_territory?: string;
          legal_name?: string | null;
          logo_url?: string | null;
          registration_number?: string | null;
          vat_number?: string | null;
          email?: string | null;
          phone?: string | null;
          address_line1?: string | null;
          address_line2?: string | null;
          postal_code?: string | null;
          city?: string | null;
          country?: string | null;
          industry?: string | null;
          default_vat_rate?: number | null;
          quote_payment_terms?: string | null;
          quote_payment_method?: string | null;
          quote_reminder_days?: number[];
          legal_form?: string | null;
          ape_code?: string | null;
          share_capital_cents?: number | null;
          rcs_city?: string | null;
          iban?: string | null;
          bic?: string | null;
          vat_regime?: VatRegime | null;
          status?: OrganizationStatus;
        };
        Relationships: [];
      };

      organization_members: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: OrgRole;
          status: MemberStatus;
          job_title: string | null;
          phone: string | null;
          invited_by: string | null;
          joined_at: string | null;
          /** Durée hebdomadaire de ce membre (temps partiel). `null` = celle de l'organisation. */
          weekly_hours: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role?: OrgRole;
          status?: MemberStatus;
          job_title?: string | null;
          phone?: string | null;
          invited_by?: string | null;
          joined_at?: string | null;
          weekly_hours?: number | null;
        };
        Update: {
          role?: OrgRole;
          status?: MemberStatus;
          job_title?: string | null;
          phone?: string | null;
          joined_at?: string | null;
          weekly_hours?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'organization_members_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };

      organization_invitations: {
        Row: {
          id: string;
          organization_id: string;
          email: string;
          role: OrgRole;
          status: InvitationStatus;
          token: string;
          invited_by: string | null;
          expires_at: string;
          accepted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          email: string;
          role?: OrgRole;
          invited_by?: string | null;
          expires_at?: string;
        };
        Update: { status?: InvitationStatus; role?: OrgRole; expires_at?: string };
        Relationships: [
          {
            foreignKeyName: 'organization_invitations_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };

      // =======================================================================
      // Facturation
      // =======================================================================
      /**
       * Référentiel des métiers de terrain.
       *
       * `Insert` et `Update` sont `never`, comme pour `plans` : la table n'a
       * aucune policy d'écriture, seule une migration l'alimente. Le type
       * traduit la frontière de sécurité plutôt que de la laisser au hasard.
       */
      industries: {
        Row: {
          code: string;
          label: string;
          description: string | null;
          icon: string;
          sort_order: number;
          status: ContentStatus;
          /** Libellés propres au métier. Affichage uniquement. */
          vocabulary: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };

      /**
       * Nature du travail, par métier. Ancre les formulaires et check-lists.
       *
       * Écriture fermée, comme `industries` : les types sont livrés avec le
       * produit, versionnés en migration.
       */
      intervention_types: {
        Row: {
          id: string;
          industry_code: string;
          code: string;
          label: string;
          description: string | null;
          icon: string;
          sort_order: number;
          status: ContentStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'intervention_types_industry_code_fkey';
            columns: ['industry_code'];
            referencedRelation: 'industries';
            referencedColumns: ['code'];
          },
        ];
      };

      /**
       * Classement du matériel.
       *
       * `industry_code` nul = catégorie commune à tous les métiers. Contrairement
       * aux types d'intervention, aucun trigger ne restreint le classement au
       * métier de l'organisation : on range un outil, on ne l'autorise pas.
       */
      equipment_categories: {
        Row: {
          id: string;
          industry_code: string | null;
          code: string;
          label: string;
          icon: string;
          sort_order: number;
          status: ContentStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'equipment_categories_industry_code_fkey';
            columns: ['industry_code'];
            referencedRelation: 'industries';
            referencedColumns: ['code'];
          },
        ];
      };

      /** Modèle de saisie rattaché à un type d'intervention. Une ligne = une version. */
      form_templates: {
        Row: {
          id: string;
          intervention_type_id: string;
          version: number;
          label: string;
          description: string | null;
          status: ContentStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'form_templates_intervention_type_id_fkey';
            columns: ['intervention_type_id'];
            referencedRelation: 'intervention_types';
            referencedColumns: ['id'];
          },
        ];
      };

      form_fields: {
        Row: {
          id: string;
          form_template_id: string;
          /** Clé stable employée dans le document de réponses. */
          key: string;
          label: string;
          help: string | null;
          type: FormFieldType;
          required: boolean;
          /** Étiquette affichée près du champ : dB, bar, m². Jamais convertie. */
          unit: string | null;
          min_value: number | null;
          max_value: number | null;
          /** Tableau de chaînes pour `select` et `multiselect`, nul ailleurs. */
          options: Json;
          sort_order: number;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'form_fields_form_template_id_fkey';
            columns: ['form_template_id'];
            referencedRelation: 'form_templates';
            referencedColumns: ['id'];
          },
        ];
      };

      /**
       * Réponses saisies, validées à l'écriture contre `form_fields` par
       * `app.validate_form_response`.
       */
      intervention_form_responses: {
        Row: {
          id: string;
          intervention_id: string;
          organization_id: string;
          form_template_id: string;
          values: Json;
          /** Non nul = déclaré complet. C'est alors que les champs obligatoires s'imposent. */
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          intervention_id: string;
          organization_id: string;
          form_template_id: string;
          values?: Json;
          completed_at?: string | null;
        };
        Update: {
          values?: Json;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'intervention_form_responses_intervention_id_fkey';
            columns: ['intervention_id'];
            referencedRelation: 'interventions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'intervention_form_responses_form_template_id_fkey';
            columns: ['form_template_id'];
            referencedRelation: 'form_templates';
            referencedColumns: ['id'];
          },
        ];
      };

      /** Points de contrôle d'un type d'intervention. Une ligne = une version. */
      checklist_templates: {
        Row: {
          id: string;
          intervention_type_id: string;
          version: number;
          label: string;
          description: string | null;
          status: ContentStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'checklist_templates_intervention_type_id_fkey';
            columns: ['intervention_type_id'];
            referencedRelation: 'intervention_types';
            referencedColumns: ['id'];
          },
        ];
      };

      checklist_items: {
        Row: {
          id: string;
          checklist_template_id: string;
          /** Code stable retrouvé dans le document de réponses. */
          code: string;
          label: string;
          help: string | null;
          /** Non coché, il empêche la transmission du compte rendu. */
          required: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'checklist_items_checklist_template_id_fkey';
            columns: ['checklist_template_id'];
            referencedRelation: 'checklist_templates';
            referencedColumns: ['id'];
          },
        ];
      };

      intervention_checklist_responses: {
        Row: {
          id: string;
          intervention_id: string;
          organization_id: string;
          checklist_template_id: string;
          /** Tableau des codes cochés. Un point non coché est absent, pas `false`. */
          checked: Json;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          intervention_id: string;
          organization_id: string;
          checklist_template_id: string;
          checked?: Json;
          completed_at?: string | null;
        };
        Update: {
          checked?: Json;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'intervention_checklist_responses_intervention_id_fkey';
            columns: ['intervention_id'];
            referencedRelation: 'interventions';
            referencedColumns: ['id'];
          },
        ];
      };

      plans: {
        Row: {
          code: string;
          name: string;
          description: string | null;
          price_monthly_cents: number;
          price_annual_cents: number;
          /**
           * Coût d'un siège au-delà de ceux inclus. Les sièges INCLUS, eux,
           * vivent dans `plan_features.members` — la valeur que lit
           * `app.org_feature_limit`, donc toute la chaîne d'entitlements. Les
           * dupliquer ici créerait deux vérités pour la même donnée.
           */
          extra_user_price_cents: number;
          /** Plafond DUR. Renseigné pour Free (1) seulement ; `null` = illimité, le dépassement est facturé. */
          max_users: number | null;
          /** Lus par le webhook pour retrouver le plan depuis un Price ID Stripe. */
          stripe_price_id_monthly: string | null;
          stripe_price_id_annual: string | null;
          currency: string;
          is_organization_plan: boolean;
          sort_order: number;
          status: ContentStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };

      plan_features: {
        Row: { plan_code: string; feature_key: string; limit_value: number | null };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'plan_features_plan_code_fkey';
            columns: ['plan_code'];
            referencedRelation: 'plans';
            referencedColumns: ['code'];
          },
        ];
      };

      subscriptions: {
        Row: {
          id: string;
          user_id: string | null;
          organization_id: string | null;
          plan_code: string;
          status: SubscriptionStatus;
          current_period_start: string;
          current_period_end: string | null;
          trial_ends_at: string | null;
          canceled_at: string | null;
          /**
           * Résiliation demandée : l'accès court jusqu'à `current_period_end`,
           * puis retombe sur Free. Même nom et même sens que chez Stripe.
           */
          cancel_at_period_end: boolean;
          provider: string | null;
          provider_customer_id: string | null;
          provider_subscription_id: string | null;
          created_at: string;
          updated_at: string;
        };
        /**
         * Écriture IMPOSSIBLE depuis le client : aucune policy insert/update ne
         * l'autorise. Les abonnements sont écrits par le webhook du prestataire
         * de paiement, avec `service_role`.
         */
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'subscriptions_plan_code_fkey';
            columns: ['plan_code'];
            referencedRelation: 'plans';
            referencedColumns: ['code'];
          },
        ];
      };

      // =======================================================================
      // Équipes
      // =======================================================================
      teams: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          slug: string;
          description: string | null;
          color: string | null;
          category_id: string | null;
          manager_id: string | null;
          status: ContentStatus;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          slug: string;
          description?: string | null;
          color?: string | null;
          category_id?: string | null;
          manager_id?: string | null;
          created_by?: string | null;
        };
        Update: {
          name?: string;
          slug?: string;
          description?: string | null;
          color?: string | null;
          category_id?: string | null;
          manager_id?: string | null;
          status?: ContentStatus;
        };
        Relationships: [
          {
            foreignKeyName: 'teams_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };

      team_members: {
        Row: {
          id: string;
          team_id: string;
          member_id: string;
          role: TeamMemberRole;
          joined_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          member_id: string;
          role?: TeamMemberRole;
        };
        Update: { role?: TeamMemberRole };
        Relationships: [
          {
            foreignKeyName: 'team_members_team_id_fkey';
            columns: ['team_id'];
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'team_members_member_id_fkey';
            columns: ['member_id'];
            referencedRelation: 'organization_members';
            referencedColumns: ['id'];
          },
        ];
      };

      // =======================================================================
      // Clients
      // =======================================================================
      customers: {
        Row: {
          id: string;
          organization_id: string;
          /** `CLI-0042`, généré par trigger et unique par organisation. */
          reference: string;
          name: string;
          legal_name: string | null;
          registration_number: string | null;
          vat_number: string | null;
          email: string | null;
          phone: string | null;
          address_line1: string | null;
          address_line2: string | null;
          postal_code: string | null;
          city: string | null;
          country: string | null;
          notes: string | null;
          customer_type: CustomerType | null;
          status: ContentStatus;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        /** `reference` est absente : le trigger la calcule. */
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          legal_name?: string | null;
          registration_number?: string | null;
          vat_number?: string | null;
          email?: string | null;
          phone?: string | null;
          address_line1?: string | null;
          address_line2?: string | null;
          postal_code?: string | null;
          city?: string | null;
          country?: string | null;
          notes?: string | null;
          customer_type?: CustomerType | null;
          status?: ContentStatus;
          created_by?: string | null;
        };
        Update: Partial<
          Omit<Database['public']['Tables']['customers']['Insert'], 'organization_id'>
        >;
        Relationships: [
          {
            foreignKeyName: 'customers_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };

      customer_contacts: {
        Row: {
          id: string;
          customer_id: string;
          organization_id: string;
          first_name: string | null;
          last_name: string;
          role_label: string | null;
          email: string | null;
          phone: string | null;
          is_primary: boolean;
          notes: string | null;
          /** Accès au portail client. Modifiable seulement avec `client_portal.manage` (trigger). */
          portal_enabled: boolean;
          portal_last_seen_at: string | null;
          created_at: string;
          updated_at: string;
        };
        /** `organization_id` est écrasé par trigger depuis le client parent. */
        Insert: {
          id?: string;
          customer_id: string;
          organization_id: string;
          first_name?: string | null;
          last_name: string;
          role_label?: string | null;
          email?: string | null;
          phone?: string | null;
          is_primary?: boolean;
          notes?: string | null;
          portal_enabled?: boolean;
        };
        Update: Partial<
          Omit<
            Database['public']['Tables']['customer_contacts']['Insert'],
            'customer_id' | 'organization_id'
          >
        >;
        Relationships: [
          {
            foreignKeyName: 'customer_contacts_customer_id_fkey';
            columns: ['customer_id'];
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
        ];
      };

      sites: {
        Row: {
          id: string;
          customer_id: string;
          organization_id: string;
          name: string;
          /** Référence interne du client (« PBO-1245 »), pas la nôtre. */
          code: string | null;
          address_line1: string | null;
          address_line2: string | null;
          postal_code: string | null;
          city: string | null;
          country: string | null;
          latitude: number | null;
          longitude: number | null;
          /** Codes d'accès, consignes de sécurité, horaires. */
          access_notes: string | null;
          contact_id: string | null;
          status: ContentStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          organization_id: string;
          name: string;
          code?: string | null;
          address_line1?: string | null;
          address_line2?: string | null;
          postal_code?: string | null;
          city?: string | null;
          country?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          access_notes?: string | null;
          contact_id?: string | null;
          status?: ContentStatus;
        };
        Update: Partial<
          Omit<Database['public']['Tables']['sites']['Insert'], 'customer_id' | 'organization_id'>
        >;
        Relationships: [
          {
            foreignKeyName: 'sites_customer_id_fkey';
            columns: ['customer_id'];
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
        ];
      };

      // =======================================================================
      // Missions
      // =======================================================================
      missions: {
        Row: {
          id: string;
          organization_id: string;
          reference: string;
          title: string;
          description: string | null;
          /** Héritée du catalogue d'outils. Inutilisée : aucune mission ne la renseigne. */
          category_id: string | null;
          /** Nature du travail, dans le métier de l'organisation. */
          intervention_type_id: string | null;
          /**
           * Rattachement à la fiche client. Facultatif : une mission d'urgence
           * peut naître sans client enregistré. `on delete set null` — supprimer
           * une fiche ne doit jamais faire disparaître une mission.
           */
          customer_id: string | null;
          /** Site d'intervention. Impose son client : le trigger le déduit. */
          site_id: string | null;
          priority: MissionPriority;
          status: MissionStatus;
          assigned_team_id: string | null;
          assigned_user_id: string | null;
          scheduled_start: string | null;
          scheduled_end: string | null;
          /** Chevauchement avec une autre mission du même technicien vu et accepté. */
          schedule_conflict_acknowledged: boolean;
          actual_start: string | null;
          actual_end: string | null;
          location_label: string | null;
          address_line1: string | null;
          address_line2: string | null;
          postal_code: string | null;
          city: string | null;
          country: string | null;
          latitude: number | null;
          longitude: number | null;
          customer_name: string | null;
          customer_contact: string | null;
          customer_phone: string | null;
          customer_email: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          /** Généré par trigger si omis : `AAAA-NNNN`, par organisation. */
          reference?: string;
          title: string;
          description?: string | null;
          category_id?: string | null;
          intervention_type_id?: string | null;
          customer_id?: string | null;
          site_id?: string | null;
          priority?: MissionPriority;
          assigned_team_id?: string | null;
          assigned_user_id?: string | null;
          scheduled_start?: string | null;
          scheduled_end?: string | null;
          schedule_conflict_acknowledged?: boolean;
          location_label?: string | null;
          address_line1?: string | null;
          address_line2?: string | null;
          postal_code?: string | null;
          city?: string | null;
          country?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          customer_name?: string | null;
          customer_contact?: string | null;
          customer_phone?: string | null;
          customer_email?: string | null;
          notes?: string | null;
          /** Imposé à `auth.uid()` par la policy d'insertion. */
          created_by: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          category_id?: string | null;
          intervention_type_id?: string | null;
          customer_id?: string | null;
          site_id?: string | null;
          priority?: MissionPriority;
          /** Toute transition passe par la machine à états (trigger). */
          status?: MissionStatus;
          assigned_team_id?: string | null;
          assigned_user_id?: string | null;
          scheduled_start?: string | null;
          scheduled_end?: string | null;
          schedule_conflict_acknowledged?: boolean;
          location_label?: string | null;
          address_line1?: string | null;
          address_line2?: string | null;
          postal_code?: string | null;
          city?: string | null;
          country?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          customer_name?: string | null;
          customer_contact?: string | null;
          customer_phone?: string | null;
          customer_email?: string | null;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'missions_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'missions_assigned_team_id_fkey';
            columns: ['assigned_team_id'];
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'missions_assigned_user_id_fkey';
            columns: ['assigned_user_id'];
            referencedRelation: 'organization_members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'missions_category_id_fkey';
            columns: ['category_id'];
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
        ];
      };

      mission_assignments: {
        Row: {
          id: string;
          mission_id: string;
          team_id: string | null;
          member_id: string | null;
          assigned_by: string | null;
          assigned_at: string;
          unassigned_at: string | null;
          accepted_at: string | null;
          declined_at: string | null;
          decline_reason: string | null;
        };
        Insert: {
          id?: string;
          mission_id: string;
          team_id?: string | null;
          member_id?: string | null;
          assigned_by?: string | null;
        };
        Update: {
          unassigned_at?: string | null;
          accepted_at?: string | null;
          declined_at?: string | null;
          decline_reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'mission_assignments_mission_id_fkey';
            columns: ['mission_id'];
            referencedRelation: 'missions';
            referencedColumns: ['id'];
          },
        ];
      };

      mission_status_transitions: {
        Row: {
          from_status: MissionStatus;
          to_status: MissionStatus;
          required_permission: string | null;
          assignee_only: boolean;
          description: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };

      mission_status_events: {
        Row: {
          id: string;
          mission_id: string;
          from_status: MissionStatus | null;
          to_status: MissionStatus;
          actor_id: string | null;
          reason: string | null;
          created_at: string;
        };
        /** Écrit exclusivement par le trigger de transition. */
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'mission_status_events_mission_id_fkey';
            columns: ['mission_id'];
            referencedRelation: 'missions';
            referencedColumns: ['id'];
          },
        ];
      };

      // =======================================================================
      // Interventions
      // =======================================================================
      /**
       * Segments de temps — démarrage, pause, reprise, fin.
       *
       * `started_at` et `ended_at` sont ABSENTS de `Insert` et d'`Update` : le
       * trigger `enforce_time_entry` impose l'heure du serveur. Un relevé
       * d'heures que l'intéressé peut antidater ne prouve rien.
       *
       * Fermer un segment se fait en écrivant `ended_at` — n'importe quelle
       * valeur non nulle, que le trigger remplace par `now()`. D'où le type
       * `string` conservé en `Update`.
       */
      intervention_time_entries: {
        Row: {
          id: string;
          intervention_id: string;
          organization_id: string;
          technician_id: string;
          technician_user_id: string;
          kind: TimeEntryKind;
          started_at: string;
          ended_at: string | null;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          intervention_id: string;
          /** Écrasé par trigger depuis l'intervention parente. */
          organization_id: string;
          /** Dérivés de l'affectation par trigger. */
          technician_id?: string;
          technician_user_id?: string;
          kind?: TimeEntryKind;
          reason?: string | null;
        };
        /** Seule la clôture est permise ; le trigger refuse tout le reste. */
        Update: { ended_at?: string };
        Relationships: [
          {
            foreignKeyName: 'intervention_time_entries_intervention_id_fkey';
            columns: ['intervention_id'];
            referencedRelation: 'interventions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'intervention_time_entries_technician_id_fkey';
            columns: ['technician_id'];
            referencedRelation: 'organization_members';
            referencedColumns: ['id'];
          },
        ];
      };

      interventions: {
        Row: {
          id: string;
          mission_id: string;
          organization_id: string;
          technician_id: string;
          status: InterventionStatus;
          start_time: string | null;
          end_time: string | null;
          start_latitude: number | null;
          start_longitude: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          mission_id: string;
          /** Dérivé de la mission par trigger — toute valeur fournie est écrasée. */
          organization_id?: string;
          technician_id: string;
          status?: InterventionStatus;
          start_time?: string | null;
          end_time?: string | null;
          start_latitude?: number | null;
          start_longitude?: number | null;
          notes?: string | null;
        };
        Update: {
          status?: InterventionStatus;
          start_time?: string | null;
          end_time?: string | null;
          start_latitude?: number | null;
          start_longitude?: number | null;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'interventions_mission_id_fkey';
            columns: ['mission_id'];
            referencedRelation: 'missions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'interventions_technician_id_fkey';
            columns: ['technician_id'];
            referencedRelation: 'organization_members';
            referencedColumns: ['id'];
          },
        ];
      };

      intervention_reports: {
        Row: {
          id: string;
          intervention_id: string;
          organization_id: string;
          technician_id: string;
          work_description: string | null;
          observations: string | null;
          materials_used: Json;
          tools_used: Json;
          customer_signature_path: string | null;
          customer_signature_name: string | null;
          technician_signature_path: string | null;
          status: ReportStatus;
          submitted_at: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          rejection_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          intervention_id: string;
          /** Dérivés de l'intervention par trigger. */
          organization_id?: string;
          technician_id?: string;
          work_description?: string | null;
          observations?: string | null;
          materials_used?: Json;
          tools_used?: Json;
          customer_signature_path?: string | null;
          customer_signature_name?: string | null;
          technician_signature_path?: string | null;
        };
        Update: {
          work_description?: string | null;
          observations?: string | null;
          materials_used?: Json;
          tools_used?: Json;
          customer_signature_path?: string | null;
          customer_signature_name?: string | null;
          technician_signature_path?: string | null;
          status?: ReportStatus;
          rejection_reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'intervention_reports_intervention_id_fkey';
            columns: ['intervention_id'];
            referencedRelation: 'interventions';
            referencedColumns: ['id'];
          },
        ];
      };

      intervention_attachments: {
        Row: {
          id: string;
          intervention_id: string;
          organization_id: string;
          kind: AttachmentKind;
          storage_path: string;
          file_name: string;
          mime_type: string | null;
          size_bytes: number | null;
          caption: string | null;
          uploaded_by: string | null;
          /** Privé par défaut ; visible par le client seulement après partage explicite. */
          shared_with_client: boolean;
          shared_at: string | null;
          shared_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          intervention_id: string;
          organization_id?: string;
          kind?: AttachmentKind;
          /** DOIT commencer par `{organization_id}/` — vérifié par trigger. */
          storage_path: string;
          file_name: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          caption?: string | null;
          uploaded_by: string;
        };
        /** `shared_with_client` seul : le trigger refuse toute autre colonne dans la même écriture. */
        Update: { caption?: string | null; kind?: AttachmentKind; shared_with_client?: boolean };
        Relationships: [
          {
            foreignKeyName: 'intervention_attachments_intervention_id_fkey';
            columns: ['intervention_id'];
            referencedRelation: 'interventions';
            referencedColumns: ['id'];
          },
        ];
      };

      // =======================================================================
      // Parc materiel
      // =======================================================================
      /**
       * Parc ROULANT. Droits communs avec `equipment` — qui voit l'outillage
       * voit les véhicules — mais table distincte : une immatriculation, un
       * contrôle technique et un conducteur n'ont pas d'équivalent sur une
       * soudeuse.
       */
      vehicles: {
        Row: {
          id: string;
          organization_id: string;
          plate: string;
          brand: string;
          model: string;
          type: VehicleType;
          fuel: VehicleFuel;
          status: VehicleStatus;
          mileage: number;
          assigned_member_id: string | null;
          next_ct_date: string | null;
          next_revision_date: string | null;
          next_revision_mileage: number | null;
          insurance_expiry_date: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          plate: string;
          brand: string;
          model: string;
          type?: VehicleType;
          fuel?: VehicleFuel;
          status?: VehicleStatus;
          mileage?: number;
          assigned_member_id?: string | null;
          next_ct_date?: string | null;
          next_revision_date?: string | null;
          next_revision_mileage?: number | null;
          insurance_expiry_date?: string | null;
          notes?: string | null;
          created_by?: string | null;
        };
        Update: {
          plate?: string;
          brand?: string;
          model?: string;
          type?: VehicleType;
          fuel?: VehicleFuel;
          status?: VehicleStatus;
          mileage?: number;
          assigned_member_id?: string | null;
          next_ct_date?: string | null;
          next_revision_date?: string | null;
          next_revision_mileage?: number | null;
          insurance_expiry_date?: string | null;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'vehicles_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };

      /** Entretiens d'un véhicule. La portée se lit à travers lui. */
      vehicle_maintenance_records: {
        Row: {
          id: string;
          vehicle_id: string;
          performed_on: string;
          type: VehicleMaintenanceType;
          description: string;
          mileage: number;
          cost_cents: number | null;
          performed_by: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          performed_on: string;
          type?: VehicleMaintenanceType;
          description: string;
          mileage: number;
          cost_cents?: number | null;
          performed_by?: string | null;
          created_by?: string | null;
        };
        /** Un entretien passé ne se réécrit pas : aucune policy UPDATE. */
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'vehicle_maintenance_records_vehicle_id_fkey';
            columns: ['vehicle_id'];
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
        ];
      };

      /**
       * Consommables tenus en stock.
       *
       * Les montants sont en EUROS (`numeric(12,2)`) et non en centimes,
       * contrairement au reste du projet : écart assumé, documenté dans
       * `20260820110000_stock.sql`. Les quantités sont `numeric` car un câble
       * se stocke au mètre.
       */
      stock_consumables: {
        Row: {
          id: string;
          organization_id: string;
          reference: string;
          name: string;
          category: string;
          unit: string;
          quantity_in_stock: number;
          min_threshold: number;
          unit_price_eur: number | null;
          selling_price_eur: number | null;
          location: string;
          supplier: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          reference: string;
          name: string;
          category?: string;
          unit?: string;
          quantity_in_stock?: number;
          min_threshold?: number;
          unit_price_eur?: number | null;
          selling_price_eur?: number | null;
          location?: string;
          supplier?: string | null;
          notes?: string | null;
        };
        Update: {
          reference?: string;
          name?: string;
          category?: string;
          unit?: string;
          quantity_in_stock?: number;
          min_threshold?: number;
          unit_price_eur?: number | null;
          selling_price_eur?: number | null;
          location?: string;
          supplier?: string | null;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'stock_consumables_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };

      /**
       * Journal des mouvements de stock.
       *
       * `consumable_name` et `consumable_reference` sont des INSTANTANÉS : ils
       * survivent au renommage comme à la suppression de l'article, dont la clé
       * étrangère est `on delete set null`.
       *
       * Ce journal ne s'écrit pas directement : la quantité de l'article et le
       * mouvement doivent bouger ensemble, ce que garantit la fonction
       * `record_stock_movement`.
       */
      stock_movements: {
        Row: {
          id: string;
          organization_id: string;
          consumable_id: string | null;
          consumable_name: string;
          consumable_reference: string;
          type: StockMovementType;
          /** Toujours positive : c'est `type` qui porte le sens. */
          quantity: number;
          reason: string;
          technician_id: string | null;
          technician_name: string | null;
          intervention_ref: string | null;
          location_from: string | null;
          location_to: string | null;
          occurred_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          consumable_id?: string | null;
          consumable_name: string;
          consumable_reference: string;
          type: StockMovementType;
          quantity: number;
          reason?: string;
          technician_id?: string | null;
          technician_name?: string | null;
          intervention_ref?: string | null;
          location_from?: string | null;
          location_to?: string | null;
          occurred_at?: string;
        };
        /** Un mouvement passé ne se réécrit pas : aucune policy UPDATE. */
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'stock_movements_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stock_movements_consumable_id_fkey';
            columns: ['consumable_id'];
            referencedRelation: 'stock_consumables';
            referencedColumns: ['id'];
          },
        ];
      };

      /** Fournisseurs de l'organisation. */
      suppliers: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          code: string | null;
          contact_name: string | null;
          email: string | null;
          phone: string | null;
          address: string | null;
          city: string | null;
          postal_code: string | null;
          siret: string | null;
          vat_number: string | null;
          website: string | null;
          default_payment_terms: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          code?: string | null;
          contact_name?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          city?: string | null;
          postal_code?: string | null;
          siret?: string | null;
          vat_number?: string | null;
          website?: string | null;
          default_payment_terms?: string | null;
          notes?: string | null;
        };
        Update: {
          name?: string;
          code?: string | null;
          contact_name?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          city?: string | null;
          postal_code?: string | null;
          siret?: string | null;
          vat_number?: string | null;
          website?: string | null;
          default_payment_terms?: string | null;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'suppliers_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };

      /**
       * Bons de commande fournisseur.
       *
       * `supplier_name` / `_email` / `_phone` / `_address` et `mission_ref` sont
       * des INSTANTANÉS figés à la création : une commande reste lisible telle
       * qu'elle a été passée, même si la fiche fournisseur change ou disparaît.
       *
       * Les totaux ne figurent pas ici — ils découlent des lignes et sont
       * dérivés dans `purchases.api.ts`, comme la vue `quote_totals` le fait
       * pour les devis.
       *
       * `reference` est générée par trigger (`CMD-AAAA-NNN`) quand elle est
       * absente : la laisser au client produisait des doublons.
       */
      purchase_orders: {
        Row: {
          id: string;
          organization_id: string;
          reference: string;
          supplier_id: string | null;
          supplier_name: string;
          supplier_email: string | null;
          supplier_phone: string | null;
          supplier_address: string | null;
          status: PurchaseOrderStatus;
          order_date: string;
          expected_delivery_date: string | null;
          received_date: string | null;
          mission_id: string | null;
          mission_ref: string | null;
          /** Taux, pas pourcentage : 0.20 pour 20 %. */
          tax_rate: number;
          notes: string | null;
          delivery_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          reference?: string;
          supplier_id?: string | null;
          supplier_name: string;
          supplier_email?: string | null;
          supplier_phone?: string | null;
          supplier_address?: string | null;
          status?: PurchaseOrderStatus;
          order_date?: string;
          expected_delivery_date?: string | null;
          received_date?: string | null;
          mission_id?: string | null;
          mission_ref?: string | null;
          tax_rate?: number;
          notes?: string | null;
          delivery_notes?: string | null;
        };
        Update: {
          reference?: string;
          supplier_id?: string | null;
          supplier_name?: string;
          supplier_email?: string | null;
          supplier_phone?: string | null;
          supplier_address?: string | null;
          status?: PurchaseOrderStatus;
          order_date?: string;
          expected_delivery_date?: string | null;
          received_date?: string | null;
          mission_id?: string | null;
          mission_ref?: string | null;
          tax_rate?: number;
          notes?: string | null;
          delivery_notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'purchase_orders_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'purchase_orders_supplier_id_fkey';
            columns: ['supplier_id'];
            referencedRelation: 'suppliers';
            referencedColumns: ['id'];
          },
        ];
      };

      /**
       * Lignes d'un bon de commande.
       *
       * `id` est structurellement critique : c'est la clé du dictionnaire
       * `{ id_de_ligne: quantité reçue }` envoyé à `receive_purchase_order`.
       */
      purchase_order_items: {
        Row: {
          id: string;
          purchase_order_id: string;
          consumable_id: string | null;
          reference: string;
          description: string;
          unit: string;
          quantity_ordered: number;
          quantity_received: number;
          unit_price_eur: number;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          purchase_order_id: string;
          consumable_id?: string | null;
          reference?: string;
          description?: string;
          unit?: string;
          quantity_ordered?: number;
          quantity_received?: number;
          unit_price_eur?: number;
          position?: number;
        };
        Update: {
          consumable_id?: string | null;
          reference?: string;
          description?: string;
          unit?: string;
          quantity_ordered?: number;
          quantity_received?: number;
          unit_price_eur?: number;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'purchase_order_items_purchase_order_id_fkey';
            columns: ['purchase_order_id'];
            referencedRelation: 'purchase_orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'purchase_order_items_consumable_id_fkey';
            columns: ['consumable_id'];
            referencedRelation: 'stock_consumables';
            referencedColumns: ['id'];
          },
        ];
      };

      equipment: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          brand: string | null;
          serial_number: string | null;
          /** Vestige de l'enum fibre. Tenu en phase avec `category_id` par trigger. */
          category: EquipmentCategory;
          /** Classement par métier. Remplace `category`. */
          category_id: string | null;
          status: EquipmentStatus;
          condition: EquipmentCondition;
          assigned_member_id: string | null;
          last_calibration: string | null;
          next_calibration: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          brand?: string | null;
          serial_number?: string | null;
          category?: EquipmentCategory;
          category_id?: string | null;
          status?: EquipmentStatus;
          condition?: EquipmentCondition;
          assigned_member_id?: string | null;
          last_calibration?: string | null;
          next_calibration?: string | null;
          notes?: string | null;
          created_by?: string | null;
        };
        Update: {
          name?: string;
          brand?: string | null;
          serial_number?: string | null;
          category?: EquipmentCategory;
          category_id?: string | null;
          status?: EquipmentStatus;
          condition?: EquipmentCondition;
          assigned_member_id?: string | null;
          last_calibration?: string | null;
          next_calibration?: string | null;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'equipment_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'equipment_assigned_member_id_fkey';
            columns: ['assigned_member_id'];
            referencedRelation: 'organization_members';
            referencedColumns: ['id'];
          },
        ];
      };

      // =======================================================================
      // Devis
      // =======================================================================
      quote_templates: {
        Row: {
          id: string;
          organization_id: string;
          label: string;
          unit: string;
          unit_price_cents: number;
          sort_order: number;
          status: ContentStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          label: string;
          unit?: string;
          unit_price_cents?: number;
          sort_order?: number;
          status?: ContentStatus;
        };
        Update: {
          label?: string;
          unit?: string;
          unit_price_cents?: number;
          sort_order?: number;
          status?: ContentStatus;
        };
        Relationships: [
          {
            foreignKeyName: 'quote_templates_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };

      quotes: {
        Row: {
          id: string;
          organization_id: string;
          reference: string;
          title: string | null;
          customer_id: string | null;
          site_id: string | null;
          customer_name: string | null;
          site_name: string | null;
          /** Pourcentage : `8.50` pour 8,5 %. */
          vat_rate: number;
          status: QuoteStatus;
          notes: string | null;
          document_options: Json;
          discount_rate: number;
          valid_until: string | null;
          created_by: string | null;
          /** Réponse donnée depuis le portail client ; NULL si décidée par l'entreprise. */
          client_responded_at: string | null;
          /** Posée par trigger au passage à « envoyé » ; NULL pour un devis envoyé avant les relances automatiques. */
          sent_at: string | null;
          /** Relances automatiques pour CE devis (le réglage de l'entreprise reste intact). */
          reminders_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          /** Generee par trigger si omise : `DEV-nnnn`, par organisation. */
          reference?: string;
          title?: string | null;
          customer_id?: string | null;
          site_id?: string | null;
          customer_name?: string | null;
          site_name?: string | null;
          vat_rate?: number;
          status?: QuoteStatus;
          notes?: string | null;
          document_options?: Json;
          discount_rate?: number;
          valid_until?: string | null;
          created_by?: string | null;
        };
        Update: {
          title?: string | null;
          customer_id?: string | null;
          site_id?: string | null;
          customer_name?: string | null;
          site_name?: string | null;
          vat_rate?: number;
          status?: QuoteStatus;
          notes?: string | null;
          document_options?: Json;
          discount_rate?: number;
          valid_until?: string | null;
          reminders_enabled?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'quotes_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'quotes_customer_id_fkey';
            columns: ['customer_id'];
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
        ];
      };

      document_numbering_settings: {
        Row: {
          organization_id: string;
          document_kind: DocumentKind;
          format: DocumentNumberingFormat;
          next_value: number;
          configured: boolean;
          updated_at: string;
        };
        Insert: {
          organization_id: string;
          document_kind: DocumentKind;
          format: DocumentNumberingFormat;
          next_value?: number;
          configured?: boolean;
          updated_at?: string;
        };
        Update: {
          format?: DocumentNumberingFormat;
          next_value?: number;
          configured?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'document_numbering_settings_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };

      quote_reminders: {
        Row: {
          id: string;
          organization_id: string;
          quote_id: string;
          /** 1 = première relance, 2 = deuxième… */
          sequence: number;
          due_at: string;
          status: QuoteReminderStatus;
          message_id: string | null;
          /** Motif d'un `skipped` ou d'un `failed`, lisible par l'entreprise. */
          reason: string | null;
          attempts: number;
          sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        /** Écrite par trigger et par le worker uniquement. */
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'quote_reminders_quote_id_fkey';
            columns: ['quote_id'];
            referencedRelation: 'quotes';
            referencedColumns: ['id'];
          },
        ];
      };

      quote_items: {
        Row: {
          id: string;
          quote_id: string;
          organization_id: string;
          description: string;
          unit: string;
          quantity: number;
          unit_price_cents: number;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          quote_id: string;
          /** Ecrase par trigger depuis le devis ; requis par la contrainte NOT NULL. */
          organization_id: string;
          description: string;
          unit?: string;
          quantity?: number;
          unit_price_cents?: number;
          position?: number;
        };
        Update: {
          description?: string;
          unit?: string;
          quantity?: number;
          unit_price_cents?: number;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'quote_items_quote_id_fkey';
            columns: ['quote_id'];
            referencedRelation: 'quotes';
            referencedColumns: ['id'];
          },
        ];
      };

      // =======================================================================
      // Factures
      // =======================================================================
      /**
       * Un encaissement sur une facture de vente (D4). Le solde n'est jamais
       * stocké : voir la vue `invoice_balances`. `status = 'paid'` suit ces
       * lignes par trigger ; il ne se pose plus à la main.
       */
      /**
       * Le compte client — 20261001090000_compte_client.sql. Un crédit naît
       * d'un avoir émis (trigger) ou d'un trop-perçu accepté (record_payment) :
       * jamais inséré par le client. Son solde : `customer_credit_balances`.
       */
      customer_credits: {
        Row: {
          id: string;
          organization_id: string;
          customer_id: string;
          origin: CustomerCreditOrigin;
          credit_note_id: string | null;
          payment_id: string | null;
          amount_cents: number;
          note: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: never;
        Update: { note?: string | null };
        Relationships: [
          {
            foreignKeyName: 'customer_credits_customer_id_fkey';
            columns: ['customer_id'];
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_credits_credit_note_id_fkey';
            columns: ['credit_note_id'];
            referencedRelation: 'invoices';
            referencedColumns: ['id'];
          },
        ];
      };
      credit_allocations: {
        Row: {
          id: string;
          organization_id: string;
          credit_id: string;
          invoice_id: string;
          amount_cents: number;
          allocated_on: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          organization_id?: string;
          credit_id: string;
          invoice_id: string;
          amount_cents: number;
          allocated_on?: string;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'credit_allocations_credit_id_fkey';
            columns: ['credit_id'];
            referencedRelation: 'customer_credits';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'credit_allocations_invoice_id_fkey';
            columns: ['invoice_id'];
            referencedRelation: 'invoices';
            referencedColumns: ['id'];
          },
        ];
      };
      credit_refunds: {
        Row: {
          id: string;
          organization_id: string;
          credit_id: string;
          amount_cents: number;
          paid_on: string;
          method: PaymentMethod;
          reference: string | null;
          note: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          organization_id?: string;
          credit_id: string;
          amount_cents: number;
          paid_on?: string;
          method?: PaymentMethod;
          reference?: string | null;
          note?: string | null;
        };
        Update: {
          amount_cents?: number;
          paid_on?: string;
          method?: PaymentMethod;
          reference?: string | null;
          note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'credit_refunds_credit_id_fkey';
            columns: ['credit_id'];
            referencedRelation: 'customer_credits';
            referencedColumns: ['id'];
          },
        ];
      };
      invoice_payments: {
        Row: {
          id: string;
          organization_id: string;
          invoice_id: string;
          amount_cents: number;
          paid_on: string;
          method: PaymentMethod;
          reference: string | null;
          note: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          invoice_id: string;
          amount_cents: number;
          paid_on?: string;
          method?: PaymentMethod;
          reference?: string | null;
          note?: string | null;
          created_by?: string | null;
        };
        Update: {
          amount_cents?: number;
          paid_on?: string;
          method?: PaymentMethod;
          reference?: string | null;
          note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'invoice_payments_invoice_id_fkey';
            columns: ['invoice_id'];
            referencedRelation: 'invoices';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoice_payments_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      invoices: {
        Row: {
          id: string;
          organization_id: string;
          reference: string;
          document_type: InvoiceDocumentType;
          corrects_invoice_id: string | null;
          credit_note_scope: 'full' | 'partial' | null;
          credit_note_reason: string | null;
          corrected_invoice_reference: string | null;
          corrected_invoice_issued_at: string | null;
          title: string | null;
          customer_id: string | null;
          site_id: string | null;
          quote_id: string | null;
          customer_name: string | null;
          customer_legal_name: string | null;
          customer_registration_number: string | null;
          customer_vat_number: string | null;
          customer_address_line1: string | null;
          customer_address_line2: string | null;
          customer_postal_code: string | null;
          customer_city: string | null;
          customer_country: string | null;
          customer_type: CustomerType | null;
          service_date: string | null;
          operation_type: 'goods' | 'services' | 'mixed' | null;
          buyer_reference: string | null;
          purchase_order_reference: string | null;
          delivery_address_line1: string | null;
          delivery_address_line2: string | null;
          delivery_postal_code: string | null;
          delivery_city: string | null;
          delivery_country: string | null;
          early_payment_terms: string | null;
          late_payment_terms: string | null;
          vat_on_debits: boolean | null;
          site_name: string | null;
          currency: string;
          status: InvoiceStatus;
          /** Posé par la base quand les règlements soldent la facture. NULL = payée avant le suivi. */
          status_before_payment: InvoiceStatus | null;
          issued_at: string | null;
          due_date: string | null;
          payment_terms: string | null;
          payment_method: string | null;
          notes: string | null;
          document_options: Json;
          discount_rate: number;
          /*
            Instantane de l'emetteur, pose PAR LA BASE au moment de l'emission
            (`app.freeze_invoice_seller`). Jamais ecrit par l'application : un
            chemin d'emission qui oublierait de le faire produirait une facture
            sans emetteur, et rien ne le signalerait.

            Absent de `Insert` et de `Update` pour cette raison — l'exposer
            laisserait ecrire du code que le trigger d'immuabilite rejettera.
          */
          seller_name: string | null;
          seller_legal_name: string | null;
          seller_registration_number: string | null;
          seller_vat_number: string | null;
          seller_legal_form: string | null;
          seller_ape_code: string | null;
          seller_share_capital_cents: number | null;
          seller_rcs_city: string | null;
          seller_address_line1: string | null;
          seller_address_line2: string | null;
          seller_postal_code: string | null;
          seller_city: string | null;
          seller_country: string | null;
          seller_iban: string | null;
          seller_bic: string | null;
          seller_vat_regime: VatRegime | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          /** Generee par trigger si omise : `FAC-AAAA-NNNNN`, ou `AV-` pour un avoir. */
          reference?: string;
          document_type?: InvoiceDocumentType;
          corrects_invoice_id?: string | null;
          credit_note_scope?: 'full' | 'partial' | null;
          title?: string | null;
          customer_id?: string | null;
          site_id?: string | null;
          quote_id?: string | null;
          customer_name?: string | null;
          customer_legal_name?: string | null;
          customer_registration_number?: string | null;
          customer_vat_number?: string | null;
          customer_address_line1?: string | null;
          customer_address_line2?: string | null;
          customer_postal_code?: string | null;
          customer_city?: string | null;
          customer_country?: string | null;
          customer_type?: CustomerType | null;
          service_date?: string | null;
          operation_type?: 'goods' | 'services' | 'mixed' | null;
          buyer_reference?: string | null;
          purchase_order_reference?: string | null;
          delivery_address_line1?: string | null;
          delivery_address_line2?: string | null;
          delivery_postal_code?: string | null;
          delivery_city?: string | null;
          delivery_country?: string | null;
          early_payment_terms?: string | null;
          late_payment_terms?: string | null;
          vat_on_debits?: boolean | null;
          site_name?: string | null;
          currency?: string;
          status?: InvoiceStatus;
          issued_at?: string | null;
          due_date?: string | null;
          payment_terms?: string | null;
          payment_method?: string | null;
          notes?: string | null;
          document_options?: Json;
          discount_rate?: number;
          created_by?: string | null;
        };
        /**
         * Volontairement etroit : passe l'emission, `app.enforce_invoice_immutable`
         * refuse toute modification des champs comptables. Les exposer ici
         * laisserait ecrire du code que la base rejettera.
         */
        Update: {
          title?: string | null;
          status?: InvoiceStatus;
          notes?: string | null;
          document_options?: Json;
          discount_rate?: number;
          issued_at?: string | null;
          due_date?: string | null;
          payment_terms?: string | null;
          payment_method?: string | null;
          customer_id?: string | null;
          site_id?: string | null;
          customer_name?: string | null;
          customer_legal_name?: string | null;
          customer_registration_number?: string | null;
          customer_vat_number?: string | null;
          customer_address_line1?: string | null;
          customer_address_line2?: string | null;
          customer_postal_code?: string | null;
          customer_city?: string | null;
          customer_country?: string | null;
          customer_type?: CustomerType | null;
          service_date?: string | null;
          operation_type?: 'goods' | 'services' | 'mixed' | null;
          buyer_reference?: string | null;
          purchase_order_reference?: string | null;
          delivery_address_line1?: string | null;
          delivery_address_line2?: string | null;
          delivery_postal_code?: string | null;
          delivery_city?: string | null;
          delivery_country?: string | null;
          early_payment_terms?: string | null;
          late_payment_terms?: string | null;
          vat_on_debits?: boolean | null;
          site_name?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'invoices_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoices_customer_id_fkey';
            columns: ['customer_id'];
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoices_quote_id_fkey';
            columns: ['quote_id'];
            referencedRelation: 'quotes';
            referencedColumns: ['id'];
          },
        ];
      };

      einvoicing_provider_connections: {
        Row: {
          organization_id: string;
          provider_code: string;
          status: EinvoicingConnectionStatus;
          provider_company_id: string | null;
          provider_environment: 'sandbox' | 'production' | null;
          company_verification_status: 'verified' | 'needs_review' | 'failed' | null;
          user_identity_verification_status:
            'verified' | 'needs_review' | 'failed' | 'not_verified' | null;
          access_token_ciphertext: string | null;
          refresh_token_ciphertext: string | null;
          access_token_expires_at: string | null;
          token_type: string | null;
          connected_by: string | null;
          connected_at: string | null;
          last_verified_at: string | null;
          last_error_code: string | null;
          last_error_message: string | null;
          reception_status: EinvoicingReceptionStatus;
          reception_activated_at: string | null;
          reception_last_checked_at: string | null;
          reception_last_error_code: string | null;
          reception_last_error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          organization_id: string;
          provider_code?: string;
          status?: EinvoicingConnectionStatus;
          provider_company_id?: string | null;
          provider_environment?: 'sandbox' | 'production' | null;
          company_verification_status?: 'verified' | 'needs_review' | 'failed' | null;
          user_identity_verification_status?:
            'verified' | 'needs_review' | 'failed' | 'not_verified' | null;
          access_token_ciphertext?: string | null;
          refresh_token_ciphertext?: string | null;
          access_token_expires_at?: string | null;
          token_type?: string | null;
          connected_by?: string | null;
          connected_at?: string | null;
          last_verified_at?: string | null;
          last_error_code?: string | null;
          last_error_message?: string | null;
          reception_status?: EinvoicingReceptionStatus;
          reception_activated_at?: string | null;
          reception_last_checked_at?: string | null;
          reception_last_error_code?: string | null;
          reception_last_error_message?: string | null;
        };
        Update: {
          status?: EinvoicingConnectionStatus;
          provider_company_id?: string | null;
          provider_environment?: 'sandbox' | 'production' | null;
          company_verification_status?: 'verified' | 'needs_review' | 'failed' | null;
          user_identity_verification_status?:
            'verified' | 'needs_review' | 'failed' | 'not_verified' | null;
          access_token_ciphertext?: string | null;
          refresh_token_ciphertext?: string | null;
          access_token_expires_at?: string | null;
          token_type?: string | null;
          connected_by?: string | null;
          connected_at?: string | null;
          last_verified_at?: string | null;
          last_error_code?: string | null;
          last_error_message?: string | null;
          reception_status?: EinvoicingReceptionStatus;
          reception_activated_at?: string | null;
          reception_last_checked_at?: string | null;
          reception_last_error_code?: string | null;
          reception_last_error_message?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'einvoicing_provider_connections_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };

      einvoicing_oauth_states: {
        Row: {
          id: string;
          state_sha256: string;
          organization_id: string;
          user_id: string;
          return_url: string;
          expires_at: string;
          consumed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          state_sha256: string;
          organization_id: string;
          user_id: string;
          return_url: string;
          expires_at: string;
          consumed_at?: string | null;
        };
        Update: {
          consumed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'einvoicing_oauth_states_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };

      invoice_transmissions: {
        Row: {
          id: string;
          invoice_id: string;
          organization_id: string;
          provider_code: string;
          status: InvoiceTransmissionStatus;
          idempotency_key: string;
          provider_submission_id: string | null;
          /** Environnement du dépôt : un identifiant n'existe que dans le sien. */
          provider_environment: 'sandbox' | 'production' | null;
          attempt_count: number;
          last_attempt_at: string | null;
          next_attempt_at: string | null;
          submitted_at: string | null;
          delivered_at: string | null;
          completed_at: string | null;
          last_error_code: string | null;
          last_error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          organization_id: string;
          provider_code: string;
          status?: InvoiceTransmissionStatus;
          idempotency_key?: string;
          provider_submission_id?: string | null;
          provider_environment?: 'sandbox' | 'production' | null;
          attempt_count?: number;
          last_attempt_at?: string | null;
          next_attempt_at?: string | null;
          submitted_at?: string | null;
          delivered_at?: string | null;
          completed_at?: string | null;
          last_error_code?: string | null;
          last_error_message?: string | null;
        };
        Update: {
          status?: InvoiceTransmissionStatus;
          provider_submission_id?: string | null;
          provider_environment?: 'sandbox' | 'production' | null;
          attempt_count?: number;
          last_attempt_at?: string | null;
          next_attempt_at?: string | null;
          submitted_at?: string | null;
          delivered_at?: string | null;
          completed_at?: string | null;
          last_error_code?: string | null;
          last_error_message?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'invoice_transmissions_invoice_id_fkey';
            columns: ['invoice_id'];
            referencedRelation: 'invoices';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoice_transmissions_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };

      invoice_transmission_events: {
        Row: {
          id: string;
          transmission_id: string;
          invoice_id: string;
          organization_id: string;
          source: 'application' | 'provider' | 'administration';
          event_type: string;
          normalized_status: InvoiceTransmissionStatus | null;
          provider_status_code: string | null;
          provider_event_id: string | null;
          message: string | null;
          payload_sha256: string | null;
          occurred_at: string;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          transmission_id: string;
          invoice_id: string;
          organization_id: string;
          source: 'application' | 'provider' | 'administration';
          event_type: string;
          normalized_status?: InvoiceTransmissionStatus | null;
          provider_status_code?: string | null;
          provider_event_id?: string | null;
          message?: string | null;
          payload_sha256?: string | null;
          occurred_at: string;
        };
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: 'invoice_transmission_events_transmission_id_fkey';
            columns: ['transmission_id'];
            referencedRelation: 'invoice_transmissions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoice_transmission_events_invoice_id_fkey';
            columns: ['invoice_id'];
            referencedRelation: 'invoices';
            referencedColumns: ['id'];
          },
        ];
      };

      // =======================================================================
      // Réception des factures électroniques fournisseurs (Phase 3, cf.
      // 20260926090000_einvoicing_reception.sql) — miroir de l'émission
      // ci-dessus, sens inverse. Seul `internal_status` est modifiable côté
      // client (triage métier) ; tout le reste est écrit par le worker
      // `service_role` en polling (`direction=in`, aucun webhook chez SUPER PDP).
      // =======================================================================
      received_invoices: {
        Row: {
          id: string;
          organization_id: string;
          provider_code: string;
          provider_invoice_id: string;
          internal_status: ReceivedInvoiceInternalStatus;
          regulatory_status: InvoiceTransmissionStatus | null;
          supplier_name: string | null;
          supplier_siren: string | null;
          supplier_identifier: string | null;
          currency_code: string | null;
          amount_without_vat: number | null;
          amount_vat: number | null;
          amount_with_vat: number | null;
          issue_date: string | null;
          payment_due_date: string | null;
          received_at: string;
          last_error_code: string | null;
          last_error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          provider_code?: string;
          provider_invoice_id: string;
          internal_status?: ReceivedInvoiceInternalStatus;
          regulatory_status?: InvoiceTransmissionStatus | null;
          supplier_name?: string | null;
          supplier_siren?: string | null;
          supplier_identifier?: string | null;
          currency_code?: string | null;
          amount_without_vat?: number | null;
          amount_vat?: number | null;
          amount_with_vat?: number | null;
          issue_date?: string | null;
          payment_due_date?: string | null;
          received_at?: string;
          last_error_code?: string | null;
          last_error_message?: string | null;
        };
        /** Seul `internal_status` est accordé en écriture côté client (GRANT colonne + RLS `invoice.manage`). */
        Update: { internal_status?: ReceivedInvoiceInternalStatus };
        Relationships: [
          {
            foreignKeyName: 'received_invoices_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };

      received_invoice_events: {
        Row: {
          id: string;
          received_invoice_id: string;
          organization_id: string;
          source: 'provider' | 'administration';
          event_type: string;
          normalized_status: InvoiceTransmissionStatus | null;
          provider_status_code: string | null;
          provider_event_id: string | null;
          message: string | null;
          payload_sha256: string | null;
          occurred_at: string;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          received_invoice_id: string;
          organization_id: string;
          source: 'provider' | 'administration';
          event_type: string;
          normalized_status?: InvoiceTransmissionStatus | null;
          provider_status_code?: string | null;
          provider_event_id?: string | null;
          message?: string | null;
          payload_sha256?: string | null;
          occurred_at: string;
        };
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: 'received_invoice_events_received_invoice_id_fkey';
            columns: ['received_invoice_id'];
            referencedRelation: 'received_invoices';
            referencedColumns: ['id'];
          },
        ];
      };

      received_invoice_documents: {
        Row: {
          received_invoice_id: string;
          organization_id: string;
          original_format: 'ubl' | 'cii' | 'factur_x';
          object_path: string;
          sha256: string;
          byte_size: number;
          created_at: string;
        };
        Insert: {
          received_invoice_id: string;
          organization_id: string;
          original_format: 'ubl' | 'cii' | 'factur_x';
          object_path: string;
          sha256: string;
          byte_size: number;
        };
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: 'received_invoice_documents_received_invoice_id_fkey';
            columns: ['received_invoice_id'];
            referencedRelation: 'received_invoices';
            referencedColumns: ['id'];
          },
        ];
      };

      invoice_items: {
        Row: {
          id: string;
          invoice_id: string;
          organization_id: string;
          source_invoice_item_id: string | null;
          description: string;
          unit: string;
          quantity: number;
          unit_price_cents: number;
          vat_rate: number;
          vat_category: VatCategory;
          vat_exemption_reason: string | null;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          /** Ecrase par trigger depuis la facture ; requis par la contrainte NOT NULL. */
          organization_id: string;
          source_invoice_item_id?: string | null;
          description: string;
          unit?: string;
          quantity?: number;
          unit_price_cents?: number;
          vat_rate?: number;
          vat_category?: VatCategory;
          vat_exemption_reason?: string | null;
          position?: number;
        };
        Update: {
          source_invoice_item_id?: string | null;
          description?: string;
          unit?: string;
          quantity?: number;
          unit_price_cents?: number;
          vat_rate?: number;
          vat_category?: VatCategory;
          vat_exemption_reason?: string | null;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'invoice_items_invoice_id_fkey';
            columns: ['invoice_id'];
            referencedRelation: 'invoices';
            referencedColumns: ['id'];
          },
        ];
      };

      // =======================================================================
      // Assistant IA — bibliothèque documentaire
      // =======================================================================
      ai_documents: {
        Row: {
          id: string;
          organization_id: string;
          title: string;
          description: string | null;
          category: string | null;
          filename: string;
          mime_type: string | null;
          storage_path: string;
          file_size: number | null;
          status: AiDocumentStatus;
          error_message: string | null;
          uploaded_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          title: string;
          description?: string | null;
          category?: string | null;
          filename: string;
          mime_type?: string | null;
          storage_path: string;
          file_size?: number | null;
          uploaded_by?: string | null;
        };
        Update: {
          title?: string;
          description?: string | null;
          category?: string | null;
        };
        Relationships: [];
      };

      // =======================================================================
      // Bloc-notes personnel
      // =======================================================================
      /**
       * Demandes envoyées depuis le centre d'assistance.
       *
       * `Row` est déclaré pour la forme : AUCUNE policy de lecture n'existe,
       * et c'est délibéré — il n'y a pas d'arrière-guichet dans l'application.
       * Une requête de lecture compile, et ne renvoie rien.
       */
      support_requests: {
        Row: {
          id: string;
          user_id: string | null;
          name: string;
          email: string;
          phone: string | null;
          message: string;
          attachments: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          /** Doit valoir `auth.uid()` ou `null` : la policy refuse une usurpation. */
          user_id?: string | null;
          name: string;
          email: string;
          phone?: string | null;
          message: string;
          attachments?: Json;
        };
        /** Une demande d'assistance ne se modifie ni ne s'efface depuis le client. */
        Update: never;
        Relationships: [];
      };

      training_progress: {
        Row: {
          id: string;
          user_id: string;
          course_slug: string;
          completed_chapters: string[];
          created_at: string;
          updated_at: string;
        };
        /** `user_id` est pose par trigger : le client ne l'envoie jamais. */
        Insert: {
          course_slug: string;
          completed_chapters?: string[];
        };
        Update: {
          completed_chapters?: string[];
        };
        Relationships: [];
      };
      notes: {
        Row: {
          id: string;
          user_id: string;
          organization_id: string | null;
          title: string;
          content: string;
          category: NoteCategory | null;
          is_pinned: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          /** Impose a `auth.uid()` par le trigger `notes_enforce_owner`. */
          user_id?: string;
          organization_id?: string | null;
          title?: string;
          content?: string;
          category?: NoteCategory | null;
          is_pinned?: boolean;
        };
        Update: {
          organization_id?: string | null;
          title?: string;
          content?: string;
          category?: NoteCategory | null;
          is_pinned?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'notes_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };

      // =======================================================================
      // Audit
      // =======================================================================
      document_folders: {
        Row: {
          id: string;
          organization_id: string;
          parent_folder_id: string | null;
          name: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          parent_folder_id?: string | null;
          name: string;
          created_by?: string | null;
        };
        Update: {
          name?: string;
          parent_folder_id?: string | null;
        };
        Relationships: [];
      };
      organization_documents: {
        Row: {
          id: string;
          organization_id: string;
          folder_id: string | null;
          uploaded_by: string | null;
          name: string;
          original_filename: string | null;
          storage_path: string;
          mime_type: string | null;
          file_size: number | null;
          description: string | null;
          category: string | null;
          /** Privé par défaut ; visible par le client après partage explicite ou par catégorie. */
          shared_with_client: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          folder_id?: string | null;
          uploaded_by?: string | null;
          name: string;
          original_filename?: string | null;
          storage_path: string;
          mime_type?: string | null;
          file_size?: number | null;
          description?: string | null;
          category?: string | null;
        };
        /** `organization_id` et `storage_path` sont gelés par trigger. */
        Update: {
          name?: string;
          folder_id?: string | null;
          description?: string | null;
          category?: string | null;
          /** Partage avec le portail client — exige `client_content.share` (trigger). */
          shared_with_client?: boolean;
        };
        Relationships: [];
      };
      document_storage_orphans: {
        Row: {
          id: string;
          organization_id: string;
          document_id: string | null;
          storage_path: string;
          error_message: string | null;
          recorded_at: string;
        };
        Insert: {
          organization_id: string;
          document_id?: string | null;
          storage_path: string;
          error_message?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          organization_id: string | null;
          user_id: string | null;
          actor_label: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          metadata: Json;
          created_at: string;
        };
        /** Journal immuable : écrit uniquement par triggers, jamais par le client. */
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'audit_logs_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };

      leave_requests: {
        Row: {
          id: string;
          organization_id: string;
          /**
           * Vers le MEMBRE, pas vers l'utilisateur : une même personne peut
           * appartenir à plusieurs entreprises et n'y a pas les mêmes congés.
           */
          member_id: string;
          type: LeaveType;
          start_date: string;
          end_date: string;
          /** Demi-journées comptées : décimal, pas entier. */
          /** Calculé par le serveur, jour par jour. Jamais déclaré par le client. */
          days_count: number;
          half_day_start: boolean;
          half_day_end: boolean;
          reason: string | null;
          status: LeaveStatus;
          requested_at: string;
          /** Posés par le SERVEUR, jamais par le client. */
          reviewed_by: string | null;
          reviewed_at: string | null;
          review_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          member_id: string;
          type: LeaveType;
          start_date: string;
          end_date: string;
          /**
           * Écrasé par `app.set_leave_days_count`. La colonne est `not null`,
           * il faut donc l'envoyer — mais sa valeur n'a aucun effet, exactement
           * comme `reviewed_by`.
           */
          days_count: number;
          half_day_start?: boolean;
          half_day_end?: boolean;
          reason?: string | null;
        };
        Update: {
          type?: LeaveType;
          start_date?: string;
          end_date?: string;
          half_day_start?: boolean;
          half_day_end?: boolean;
          reason?: string | null;
          status?: LeaveStatus;
          review_note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'leave_requests_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'leave_requests_member_id_fkey';
            columns: ['member_id'];
            referencedRelation: 'organization_members';
            referencedColumns: ['id'];
          },
        ];
      };

      leave_balances: {
        Row: {
          id: string;
          organization_id: string;
          member_id: string;
          year: number;
          /**
           * Seul l'ACQUIS est stocké. Le restant se déduit des congés
           * approuvés : deux colonnes se contrediraient dès la première
           * annulation.
           */
          paid_leave_acquired: number;
          rtt_acquired: number;
          recovery_hours: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          member_id: string;
          year: number;
          paid_leave_acquired?: number;
          rtt_acquired?: number;
          recovery_hours?: number;
        };
        Update: {
          paid_leave_acquired?: number;
          rtt_acquired?: number;
          recovery_hours?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'leave_balances_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'leave_balances_member_id_fkey';
            columns: ['member_id'];
            referencedRelation: 'organization_members';
            referencedColumns: ['id'];
          },
        ];
      };

      /** Trace de chaque passage du générateur de récurrences — 20260930090000_gestion_planning.sql */
      recurring_task_occurrences: {
        Row: {
          id: string;
          organization_id: string;
          recurring_task_id: string;
          occurrence_date: string;
          status: RecurringOccurrenceStatus;
          mission_id: string | null;
          reason: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'recurring_task_occurrences_recurring_task_id_fkey';
            columns: ['recurring_task_id'];
            referencedRelation: 'recurring_tasks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'recurring_task_occurrences_mission_id_fkey';
            columns: ['mission_id'];
            referencedRelation: 'missions';
            referencedColumns: ['id'];
          },
        ];
      };
      recurring_tasks: {
        Row: {
          id: string;
          organization_id: string;
          title: string;
          frequency: RecurrenceFrequency;
          next_date: string;
          customer_id: string | null;
          site_id: string | null;
          assigned_member_id: string | null;
          intervention_type_id: string | null;
          estimated_minutes: number | null;
          notes: string | null;
          is_active: boolean;
          last_generated_on: string | null;
          generated_count: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          title: string;
          frequency: RecurrenceFrequency;
          next_date: string;
          customer_id?: string | null;
          site_id?: string | null;
          assigned_member_id?: string | null;
          intervention_type_id?: string | null;
          estimated_minutes?: number | null;
          notes?: string | null;
          is_active?: boolean;
          created_by?: string | null;
        };
        Update: {
          title?: string;
          frequency?: RecurrenceFrequency;
          next_date?: string;
          customer_id?: string | null;
          site_id?: string | null;
          assigned_member_id?: string | null;
          intervention_type_id?: string | null;
          estimated_minutes?: number | null;
          notes?: string | null;
          is_active?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'recurring_tasks_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'recurring_tasks_customer_id_fkey';
            columns: ['customer_id'];
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'recurring_tasks_assigned_member_id_fkey';
            columns: ['assigned_member_id'];
            referencedRelation: 'organization_members';
            referencedColumns: ['id'];
          },
        ];
      };

      technician_locations: {
        Row: {
          /** Le membre EST la clé : une seule position courante par personne. */
          member_id: string;
          organization_id: string;
          latitude: number;
          longitude: number;
          accuracy_m: number | null;
          heading: number | null;
          speed_kmh: number | null;
          battery_pct: number | null;
          presence: TechnicianPresence;
          vehicle_plate: string | null;
          /** Horodatage du relevé, distinct de `updated_at` : le réseau retarde. */
          recorded_at: string;
          updated_at: string;
        };
        Insert: {
          member_id: string;
          organization_id: string;
          latitude: number;
          longitude: number;
          accuracy_m?: number | null;
          heading?: number | null;
          speed_kmh?: number | null;
          battery_pct?: number | null;
          presence?: TechnicianPresence;
          vehicle_plate?: string | null;
          recorded_at?: string;
        };
        Update: {
          latitude?: number;
          longitude?: number;
          accuracy_m?: number | null;
          heading?: number | null;
          speed_kmh?: number | null;
          battery_pct?: number | null;
          presence?: TechnicianPresence;
          vehicle_plate?: string | null;
          recorded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'technician_locations_member_id_fkey';
            columns: ['member_id'];
            referencedRelation: 'organization_members';
            referencedColumns: ['id'];
          },
        ];
      };

      notification_states: {
        Row: {
          user_id: string;
          organization_id: string;
          notification_key: string;
          read_at: string | null;
          dismissed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          organization_id: string;
          notification_key: string;
          read_at?: string | null;
          dismissed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          read_at?: string | null;
          dismissed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notification_states_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notification_states_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      /**
       * Workspace v1 — supabase/migrations/20260929090000_workspace.sql.
       * `organization_id` des pages et des tâches est posé par trigger depuis
       * l'espace : le client ne l'envoie pas, il ne pourrait que se tromper.
       */
      workspace_spaces: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          description: string | null;
          icon: string | null;
          position: number;
          created_by: string | null;
          /** Posé = espace personnel de ce membre, visible de lui seul (`ensure_personal_workspace_space`). */
          owner_member_id: string | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          description?: string | null;
          icon?: string | null;
          position?: number;
          created_by?: string | null;
        };
        Update: {
          name?: string;
          description?: string | null;
          icon?: string | null;
          position?: number;
          archived_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_spaces_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      workspace_pages: {
        Row: {
          id: string;
          organization_id: string;
          space_id: string;
          parent_page_id: string | null;
          title: string;
          content: TiptapDocument;
          position: number;
          created_by: string | null;
          updated_by: string | null;
          archived_at: string | null;
          /** Emoji ou nom d'icône, 40 caractères. */
          icon: string | null;
          /** Chemin dans le bucket privé `workspace-covers` : `<org>/<page>/<fichier>`. */
          cover_path: string | null;
          font_family: 'sans' | 'serif' | 'mono';
          small_text: boolean;
          full_width: boolean;
          locked: boolean;
          accent_color: 'blue' | 'violet' | 'emerald' | 'amber' | 'rose' | 'slate';
          wiki_mode: boolean;
          /** Texte extrait du JSON TipTap par la base, dans l'ordre du document. Lecture seule. */
          search_text: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string;
          space_id: string;
          parent_page_id?: string | null;
          title?: string;
          content?: TiptapDocument;
          position?: number;
          icon?: string | null;
          cover_path?: string | null;
          font_family?: 'sans' | 'serif' | 'mono';
          small_text?: boolean;
          full_width?: boolean;
          locked?: boolean;
          accent_color?: 'blue' | 'violet' | 'emerald' | 'amber' | 'rose' | 'slate';
          wiki_mode?: boolean;
        };
        Update: {
          parent_page_id?: string | null;
          title?: string;
          content?: TiptapDocument;
          position?: number;
          archived_at?: string | null;
          icon?: string | null;
          cover_path?: string | null;
          font_family?: 'sans' | 'serif' | 'mono';
          small_text?: boolean;
          full_width?: boolean;
          locked?: boolean;
          accent_color?: 'blue' | 'violet' | 'emerald' | 'amber' | 'rose' | 'slate';
          wiki_mode?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_pages_space_id_fkey';
            columns: ['space_id'];
            referencedRelation: 'workspace_spaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workspace_pages_parent_page_id_fkey';
            columns: ['parent_page_id'];
            referencedRelation: 'workspace_pages';
            referencedColumns: ['id'];
          },
        ];
      };
      workspace_page_preferences: {
        Row: {
          page_id: string;
          user_id: string;
          notification_level: 'off' | 'mentions' | 'all';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          page_id: string;
          user_id?: string;
          notification_level?: 'off' | 'mentions' | 'all';
        };
        Update: {
          notification_level?: 'off' | 'mentions' | 'all';
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_page_preferences_page_id_fkey';
            columns: ['page_id'];
            referencedRelation: 'workspace_pages';
            referencedColumns: ['id'];
          },
        ];
      };
      workspace_page_revisions: {
        Row: {
          id: string;
          organization_id: string;
          page_id: string;
          /** L'espace de la page au moment de l'archivage ; `null` = antérieur aux espaces personnels (partagé). */
          space_id: string | null;
          title: string;
          content: TiptapDocument;
          authored_by: string | null;
          authored_at: string;
          replaced_by: string | null;
          replaced_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      workspace_tasks: {
        Row: {
          id: string;
          organization_id: string;
          space_id: string;
          page_id: string | null;
          mission_id: string | null;
          title: string;
          description: string | null;
          status: WorkspaceTaskStatus;
          priority: WorkspaceTaskPriority;
          assignee_member_id: string | null;
          due_date: string | null;
          position: number;
          completed_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string;
          space_id: string;
          page_id?: string | null;
          mission_id?: string | null;
          title: string;
          description?: string | null;
          status?: WorkspaceTaskStatus;
          priority?: WorkspaceTaskPriority;
          assignee_member_id?: string | null;
          due_date?: string | null;
          position?: number;
        };
        Update: {
          page_id?: string | null;
          mission_id?: string | null;
          title?: string;
          description?: string | null;
          status?: WorkspaceTaskStatus;
          priority?: WorkspaceTaskPriority;
          assignee_member_id?: string | null;
          due_date?: string | null;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_tasks_space_id_fkey';
            columns: ['space_id'];
            referencedRelation: 'workspace_spaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workspace_tasks_page_id_fkey';
            columns: ['page_id'];
            referencedRelation: 'workspace_pages';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workspace_tasks_mission_id_fkey';
            columns: ['mission_id'];
            referencedRelation: 'missions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workspace_tasks_assignee_member_id_fkey';
            columns: ['assignee_member_id'];
            referencedRelation: 'organization_members';
            referencedColumns: ['id'];
          },
        ];
      };

      // -----------------------------------------------------------------------
      // Feuille d'heures — 20261002090000_feuille_heures.sql
      // -----------------------------------------------------------------------

      /**
       * Temps hors intervention : trajet, atelier, formation, autre. Mêmes
       * règles que les segments d'intervention : pour soi-même le serveur pose
       * l'heure (tout horodatage fourni est ignoré), un segment clos est
       * immuable, pas de suppression. Qui porte `timesheet.manage` peut poser
       * des horaires explicites, corriger et supprimer — tracé dans l'audit.
       * `organization_id` et `member_user_id` sont dérivés du membre par trigger.
       */
      work_time_entries: {
        Row: {
          id: string;
          organization_id: string;
          member_id: string;
          member_user_id: string;
          kind: WorkTimeKind;
          started_at: string;
          ended_at: string | null;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          kind?: WorkTimeKind;
          /** Ignoré sans `timesheet.manage`. */
          started_at?: string;
          /** Ignoré sans `timesheet.manage`. */
          ended_at?: string | null;
          note?: string | null;
        };
        Update: {
          member_id?: string;
          kind?: WorkTimeKind;
          started_at?: string;
          ended_at?: string | null;
          note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'work_time_entries_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'work_time_entries_member_id_fkey';
            columns: ['member_id'];
            referencedRelation: 'organization_members';
            referencedColumns: ['id'];
          },
        ];
      };

      /**
       * Un mois clos pour un membre, avec l'instantané de ses totaux. Lecture
       * seule côté client : s'écrit par `close_timesheet_month` et
       * `reopen_timesheet_month`. Une clôture rouverte reste en historique
       * (`reopened_at` posé) ; une seule est active par membre et par mois.
       */
      timesheet_closures: {
        Row: {
          id: string;
          organization_id: string;
          member_id: string;
          /** Premier jour du mois clos, AAAA-MM-01. */
          month: string;
          intervention_minutes: number;
          other_minutes: number;
          total_minutes: number;
          leave_days: number;
          note: string | null;
          closed_by: string | null;
          closed_at: string;
          reopened_by: string | null;
          reopened_at: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'timesheet_closures_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'timesheet_closures_member_id_fkey';
            columns: ['member_id'];
            referencedRelation: 'organization_members';
            referencedColumns: ['id'];
          },
        ];
      };

      // -----------------------------------------------------------------------
      // Workspace v2 — 20261003090000_workspace_v2.sql
      // -----------------------------------------------------------------------

      /** Modèle de page : système (`organization_id` null) ou d'entreprise (`workspace.manage`). */
      workspace_templates: {
        Row: {
          id: string;
          organization_id: string | null;
          name: string;
          description: string | null;
          icon: string | null;
          category: string;
          content: TiptapDocument;
          position: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          description?: string | null;
          icon?: string | null;
          category?: string;
          content: TiptapDocument;
          position?: number;
        };
        Update: {
          name?: string;
          description?: string | null;
          icon?: string | null;
          category?: string;
          content?: TiptapDocument;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_templates_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };

      /** Dernière ouverture d'une page par la personne connectée. Écrit par `touch_workspace_page`. */
      workspace_page_visits: {
        Row: {
          user_id: string;
          page_id: string;
          organization_id: string;
          visited_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'workspace_page_visits_page_id_fkey';
            columns: ['page_id'];
            referencedRelation: 'workspace_pages';
            referencedColumns: ['id'];
          },
        ];
      };

      /**
       * Un enregistrement vocal attaché à une page — 20261005090000_enregistrements_vocaux.sql.
       * Naît `uploading` (la ligne d'abord, le fichier ensuite, `submit_workspace_recording`
       * enfin) ; la transcription et le résumé sont écrits DANS LA PAGE par la base.
       * L'audio est effacé après 30 jours (`audio_deleted_at`).
       */
      workspace_recordings: {
        Row: {
          id: string;
          organization_id: string;
          page_id: string;
          created_by: string | null;
          title: string;
          /** `<org>/<page>/<fichier>` dans le bucket privé `workspace-audio`. */
          audio_path: string;
          mime_type: string;
          size_bytes: number | null;
          duration_seconds: number;
          language: string;
          status: WorkspaceRecordingStatus;
          transcript: string | null;
          summary: string | null;
          error: string | null;
          consent_confirmed_at: string;
          attempts: number;
          next_attempt_at: string;
          locked_at: string | null;
          transcribed_at: string | null;
          audio_deleted_at: string | null;
          /** Le modèle qui a transcrit — 20261006090000. */
          engine: string | null;
          /** La sortie brute du moteur, immuable une fois posée. */
          transcript_raw: string | null;
          /** Quand `transcript` a été normalisé depuis le brut ; `null` = identique. */
          transcript_normalized_at: string | null;
          /**
           * Les remplacements faits du brut au texte — 20261008090000. Rejoués
           * sur `transcript_raw`, ils redonnent `transcript`. `null` = pas de
           * passe ; `[]` = passe sans changement.
           */
          normalization_diff: NormalizationChange[] | null;
          /** Paragraphes horodatés (phase 8). */
          segments: RecordingSegment[] | null;
          /** Résumé structuré avec renvois aux segments (phase 8). */
          summary_json: Record<string, unknown> | null;
          /** Notes de la personne pendant l'enregistrement ; jamais transmises au fournisseur. */
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          page_id: string;
          title?: string;
          audio_path: string;
          mime_type: string;
          size_bytes?: number | null;
          duration_seconds: number;
          language?: string;
          consent_confirmed_at: string;
        };
        Update: {
          title?: string;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_recordings_page_id_fkey';
            columns: ['page_id'];
            referencedRelation: 'workspace_pages';
            referencedColumns: ['id'];
          },
        ];
      };

      /**
       * Le dictionnaire de transcription d'une organisation —
       * 20261007093000_organization_vocabulary.sql. Lecture : tout membre ;
       * écriture : `workspace.manage`. Un terme, un type, une source. 500 au plus.
       */
      organization_vocabulary: {
        Row: {
          id: string;
          organization_id: string;
          term: string;
          type: VocabularyType;
          source: VocabularySource;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          organization_id: string;
          term: string;
          type?: VocabularyType;
          source?: VocabularySource;
        };
        Update: {
          term?: string;
          type?: VocabularyType;
        };
        Relationships: [
          {
            foreignKeyName: 'organization_vocabulary_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };

      /** Page épinglée par la personne connectée. `user_id` et `organization_id` posés par trigger. */
      workspace_favorites: {
        Row: {
          user_id: string;
          page_id: string;
          organization_id: string;
          position: number;
          created_at: string;
        };
        Insert: {
          page_id: string;
          position?: number;
        };
        Update: {
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_favorites_page_id_fkey';
            columns: ['page_id'];
            referencedRelation: 'workspace_pages';
            referencedColumns: ['id'];
          },
        ];
      };
      user_preferences: {
        Row: {
          user_id: string;
          notify_new_mission: boolean;
          notify_maintenance_due: boolean;
          notify_stock_low: boolean;
          notify_leave_requests: boolean;
          /** E-mail quand un compte rendu est à contrôler, ou renvoyé — 20261004090000. */
          notify_report_review: boolean;
          sms_urgent_alerts: boolean;
          traffic_layer: boolean;
          vehicle_type: string;
          gps_refresh_rate: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          notify_new_mission?: boolean;
          notify_maintenance_due?: boolean;
          notify_stock_low?: boolean;
          notify_leave_requests?: boolean;
          notify_report_review?: boolean;
          sms_urgent_alerts?: boolean;
          traffic_layer?: boolean;
          vehicle_type?: string;
          gps_refresh_rate?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          notify_new_mission?: boolean;
          notify_maintenance_due?: boolean;
          notify_stock_low?: boolean;
          notify_leave_requests?: boolean;
          notify_report_review?: boolean;
          sms_urgent_alerts?: boolean;
          traffic_layer?: boolean;
          vehicle_type?: string;
          gps_refresh_rate?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_preferences_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };

      client_error_events: {
        Row: {
          id: string;
          organization_id: string | null;
          user_id: string;
          event_id: string;
          error_kind: string;
          error_name: string;
          message: string;
          stack: string | null;
          component_stack: string | null;
          route: string;
          app_version: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          user_id?: string;
          event_id: string;
          error_kind: string;
          error_name: string;
          message: string;
          stack?: string | null;
          component_stack?: string | null;
          route: string;
          app_version?: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'client_error_events_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_error_events_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };

      technician_location_pings: {
        Row: {
          id: string;
          organization_id: string;
          member_id: string;
          latitude: number;
          longitude: number;
          heading: number | null;
          speed_kmh: number | null;
          battery_pct: number | null;
          presence: TechnicianPresence;
          note: string | null;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          member_id: string;
          latitude: number;
          longitude: number;
          heading?: number | null;
          speed_kmh?: number | null;
          battery_pct?: number | null;
          presence?: TechnicianPresence;
          note?: string | null;
          recorded_at?: string;
        };
        /** Un relevé passé ne se réécrit pas : aucun UPDATE n'est accordé. */
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'technician_location_pings_member_id_fkey';
            columns: ['member_id'];
            referencedRelation: 'organization_members';
            referencedColumns: ['id'];
          },
        ];
      };
      // -----------------------------------------------------------------------
      // Portail client
      // -----------------------------------------------------------------------
      client_portal_settings: {
        Row: {
          organization_id: string;
          enabled: boolean;
          allow_client_initiated: boolean;
          display_name: string | null;
          visible_document_categories: string[];
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          organization_id: string;
          enabled?: boolean;
          allow_client_initiated?: boolean;
          display_name?: string | null;
          visible_document_categories?: string[];
        };
        Update: Partial<
          Omit<Database['public']['Tables']['client_portal_settings']['Insert'], 'organization_id'>
        >;
        Relationships: [
          {
            foreignKeyName: 'client_portal_settings_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      client_conversations: {
        Row: {
          id: string;
          organization_id: string;
          customer_id: string;
          contact_id: string;
          subject: string;
          status: ClientConversationStatus;
          initiated_by: ClientConversationInitiator;
          mission_id: string | null;
          quote_id: string | null;
          invoice_id: string | null;
          last_message_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          customer_id: string;
          contact_id: string;
          subject: string;
          status?: ClientConversationStatus;
          initiated_by: ClientConversationInitiator;
          mission_id?: string | null;
          quote_id?: string | null;
          invoice_id?: string | null;
        };
        /** Les parties (organisation, client, contact, initiateur) sont immuables. */
        Update: { subject?: string; status?: ClientConversationStatus };
        Relationships: [
          {
            foreignKeyName: 'client_conversations_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_conversations_customer_id_fkey';
            columns: ['customer_id'];
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_conversations_contact_id_fkey';
            columns: ['contact_id'];
            referencedRelation: 'customer_contacts';
            referencedColumns: ['id'];
          },
        ];
      };
      client_messages: {
        Row: {
          id: string;
          organization_id: string;
          conversation_id: string;
          direction: ClientMessageDirection;
          channel: ClientMessageChannel;
          author_user_id: string | null;
          sender_email: string | null;
          recipient_email: string | null;
          subject: string | null;
          body_text: string;
          body_html: string | null;
          resend_email_id: string | null;
          internet_message_id: string | null;
          in_reply_to: string | null;
          references_header: string | null;
          status: ClientMessageStatus;
          error: string | null;
          sent_at: string | null;
          delivered_at: string | null;
          received_at: string | null;
          read_by_client_at: string | null;
          read_by_staff_at: string | null;
          created_at: string;
        };
        /**
         * Depuis le navigateur : direction, canal, statut et champs fournisseur
         * sont réécrits par trigger. L'envoi réel passe par `portal-message-send`.
         */
        Insert: {
          id?: string;
          organization_id: string;
          conversation_id: string;
          direction: ClientMessageDirection;
          subject?: string | null;
          body_text: string;
        };
        /** Depuis le navigateur, seule la date de lecture de SON côté peut changer. */
        Update: { read_by_client_at?: string | null; read_by_staff_at?: string | null };
        Relationships: [
          {
            foreignKeyName: 'client_messages_conversation_id_fkey';
            columns: ['conversation_id'];
            referencedRelation: 'client_conversations';
            referencedColumns: ['id'];
          },
        ];
      };
      client_message_attachments: {
        Row: {
          id: string;
          organization_id: string;
          message_id: string;
          file_name: string;
          storage_path: string;
          mime_type: string;
          file_size: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          message_id: string;
          file_name: string;
          storage_path: string;
          mime_type: string;
          file_size: number;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'client_message_attachments_message_id_fkey';
            columns: ['message_id'];
            referencedRelation: 'client_messages';
            referencedColumns: ['id'];
          },
        ];
      };
      organization_document_shares: {
        Row: {
          document_id: string;
          customer_id: string;
          organization_id: string;
          shared_by: string | null;
          created_at: string;
        };
        /** `organization_id` et `shared_by` sont réécrits par trigger. */
        Insert: {
          document_id: string;
          customer_id: string;
          organization_id: string;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'organization_document_shares_document_id_fkey';
            columns: ['document_id'];
            referencedRelation: 'organization_documents';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'organization_document_shares_customer_id_fkey';
            columns: ['customer_id'];
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
        ];
      };
      // `resend_events` est délibérément absente : aucun droit pour `authenticated`,
      // seule la fonction Edge `resend-webhook` y écrit.

      // -----------------------------------------------------------------------
      // Prospect Radar — module INTERNE (pas client). Isolation totale des
      // organisations : aucune de ces tables ne porte `organization_id`, et
      // aucune n'est lisible par `authenticated` sans `prospecting.view`
      // (`app.has_platform_permission`, non exposé ici — schéma `app`).
      // -----------------------------------------------------------------------
      platform_admins: {
        Row: {
          user_id: string;
          granted_by: string | null;
          granted_at: string;
          note: string | null;
        };
        /** Attribution du premier administrateur : script ponctuel, jamais l'UI. */
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'platform_admins_granted_by_fkey';
            columns: ['granted_by'];
            referencedRelation: 'platform_admins';
            referencedColumns: ['user_id'];
          },
        ];
      };
      platform_admin_permissions: {
        Row: {
          user_id: string;
          permission: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'platform_admin_permissions_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'platform_admins';
            referencedColumns: ['user_id'];
          },
        ];
      };
      prospecting_zones: {
        Row: {
          id: string;
          code: string;
          label: string;
          department_code: string | null;
          region_code: string | null;
          territory: 'outre_mer' | 'metropole';
          priority: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          label: string;
          department_code?: string | null;
          region_code?: string | null;
          territory: 'outre_mer' | 'metropole';
          priority: number;
          active?: boolean;
        };
        Update: {
          label?: string;
          department_code?: string | null;
          region_code?: string | null;
          priority?: number;
          active?: boolean;
        };
        Relationships: [];
      };
      prospecting_sectors: {
        Row: {
          id: string;
          ape_code: string;
          label: string;
          industry_code: string | null;
          relevance_weight: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          ape_code: string;
          label: string;
          industry_code?: string | null;
          relevance_weight?: number;
          active?: boolean;
        };
        Update: {
          label?: string;
          industry_code?: string | null;
          relevance_weight?: number;
          active?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'prospecting_sectors_industry_code_fkey';
            columns: ['industry_code'];
            referencedRelation: 'industries';
            referencedColumns: ['code'];
          },
        ];
      };
      prospecting_score_weights: {
        Row: {
          criterion: string;
          weight: number;
          description: string | null;
          updated_at: string;
        };
        Insert: {
          criterion: string;
          weight: number;
          description?: string | null;
        };
        Update: {
          weight?: number;
          description?: string | null;
        };
        Relationships: [];
      };
      prospects: {
        Row: {
          siren: string;
          raison_sociale: string;
          nom_commercial: string | null;
          forme_juridique: string | null;
          ape_code: string;
          sector_id: string | null;
          created_on: string | null;
          statut_administratif: 'actif' | 'cesse';
          tranche_effectif: string | null;
          commune: string | null;
          code_postal: string | null;
          departement: string | null;
          region: string | null;
          zone_id: string | null;
          source: string;
          first_detected_at: string;
          last_checked_at: string;
          /** Calculé par trigger (Phase 5) — jamais écrit directement par l'UI. */
          opportunity_score: number;
          /** `[{ criterion, label, points }]` — jamais une raison inventée. */
          score_reasons: Json;
          priority: 'haute' | 'normale' | 'basse';
          status: ProspectStatus;
          assigned_to: string | null;
          next_followup_at: string | null;
          /** Organisation REZO360 réelle (Phase 9) — NULL tant que non converti. */
          converted_organization_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          siren: string;
          raison_sociale: string;
          nom_commercial?: string | null;
          forme_juridique?: string | null;
          ape_code: string;
          sector_id?: string | null;
          created_on?: string | null;
          statut_administratif?: 'actif' | 'cesse';
          tranche_effectif?: string | null;
          commune?: string | null;
          code_postal?: string | null;
          departement?: string | null;
          region?: string | null;
          zone_id?: string | null;
          source?: string;
          priority?: 'haute' | 'normale' | 'basse';
          status?: ProspectStatus;
          assigned_to?: string | null;
          next_followup_at?: string | null;
        };
        Update: {
          priority?: 'haute' | 'normale' | 'basse';
          status?: ProspectStatus;
          assigned_to?: string | null;
          next_followup_at?: string | null;
          converted_organization_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'prospects_sector_id_fkey';
            columns: ['sector_id'];
            referencedRelation: 'prospecting_sectors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'prospects_zone_id_fkey';
            columns: ['zone_id'];
            referencedRelation: 'prospecting_zones';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'prospects_converted_organization_id_fkey';
            columns: ['converted_organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      prospect_establishments: {
        Row: {
          siret: string;
          siren: string;
          enseigne: string | null;
          is_headquarters: boolean;
          adresse_line: string | null;
          code_postal: string | null;
          commune: string | null;
          created_at: string;
          updated_at: string;
        };
        /** Écrite exclusivement par `prospecting-worker` (service_role). */
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'prospect_establishments_siren_fkey';
            columns: ['siren'];
            referencedRelation: 'prospects';
            referencedColumns: ['siren'];
          },
        ];
      };
      prospect_contacts: {
        Row: {
          id: string;
          siren: string;
          contact_type: 'email' | 'phone' | 'website';
          value: string;
          source: string;
          collected_at: string;
          verified_at: string | null;
          confidence: number | null;
          created_at: string;
        };
        /**
         * Aucune source d'enrichissement AUTOMATISÉE branchée (Phase 11,
         * décision du 24/09/2026) — mais la saisie MANUELLE par un
         * administrateur reste possible, c'est ce que ce type autorise.
         */
        Insert: {
          id?: string;
          siren: string;
          contact_type: 'email' | 'phone' | 'website';
          value: string;
          source?: string;
          verified_at?: string | null;
          confidence?: number | null;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'prospect_contacts_siren_fkey';
            columns: ['siren'];
            referencedRelation: 'prospects';
            referencedColumns: ['siren'];
          },
        ];
      };
      prospect_notes: {
        Row: {
          id: string;
          siren: string;
          author_id: string | null;
          body: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          siren: string;
          author_id?: string | null;
          body: string;
        };
        Update: {
          body?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'prospect_notes_siren_fkey';
            columns: ['siren'];
            referencedRelation: 'prospects';
            referencedColumns: ['siren'];
          },
        ];
      };
      prospect_followups: {
        Row: {
          id: string;
          siren: string;
          due_at: string;
          note: string | null;
          kind: string | null;
          created_by: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          siren: string;
          due_at: string;
          note?: string | null;
          kind?: string | null;
          created_by?: string | null;
        };
        Update: {
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'prospect_followups_siren_fkey';
            columns: ['siren'];
            referencedRelation: 'prospects';
            referencedColumns: ['siren'];
          },
        ];
      };
      prospect_activities: {
        Row: {
          id: string;
          siren: string;
          event: string;
          actor_id: string | null;
          /** Posé uniquement aux transitions commerciales majeures (Phase 2/5). */
          score_snapshot: number | null;
          score_reasons_snapshot: Json | null;
          metadata: Json;
          created_at: string;
        };
        /** Insert-only par trigger : jamais un insert direct depuis l'UI. */
        Insert: never;
        /** Immuable — un trigger refuse toute modification, même pour un administrateur. */
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'prospect_activities_siren_fkey';
            columns: ['siren'];
            referencedRelation: 'prospects';
            referencedColumns: ['siren'];
          },
        ];
      };
      prospect_suppressions: {
        Row: {
          siren: string;
          reason: string | null;
          requested_at: string;
          created_by: string | null;
        };
        Insert: {
          siren: string;
          reason?: string | null;
          created_by?: string | null;
        };
        /** Pas d'UPDATE : une opposition se retire (DELETE) puis se repose si besoin. */
        Update: never;
        Relationships: [];
      };
      prospecting_runs: {
        Row: {
          id: string;
          started_at: string;
          completed_at: string | null;
          status: 'running' | 'completed' | 'completed_with_errors' | 'failed';
          source: string;
          fetched: number;
          filtered: number;
          created: number;
          updated: number;
          ignored: number;
          errors: number;
          error_message: string | null;
        };
        /** Écrite exclusivement par `prospecting-worker` (service_role). */
        Insert: never;
        Update: never;
        Relationships: [];
      };
      prospecting_message_templates: {
        Row: {
          id: string;
          sector_id: string;
          opening_variant: string | null;
          pain_points: Json;
          features: Json;
          body_template: string;
          created_at: string;
          updated_at: string;
        };
        /** Vide tant que la Phase 8 n'a pas rédigé les argumentaires. */
        Insert: {
          id?: string;
          sector_id: string;
          opening_variant?: string | null;
          pain_points?: Json;
          features?: Json;
          body_template: string;
        };
        Update: {
          opening_variant?: string | null;
          pain_points?: Json;
          features?: Json;
          body_template?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'prospecting_message_templates_sector_id_fkey';
            columns: ['sector_id'];
            referencedRelation: 'prospecting_sectors';
            referencedColumns: ['id'];
          },
        ];
      };
    };

    Views: {
      /**
       * Totaux d'un devis, recalcules a la demande depuis ses lignes.
       *
       * Vue `security_invoker` : elle herite des policies de `quotes` et
       * `quote_items`, et ne constitue donc pas une porte derobee.
       */
      quote_totals: {
        Row: {
          quote_id: string;
          organization_id: string;
          gross_subtotal_cents: number;
          discount_cents: number;
          subtotal_cents: number;
          vat_cents: number;
          total_cents: number;
        };
        Relationships: [];
      };

      invoice_totals: {
        Row: {
          invoice_id: string;
          organization_id: string;
          gross_subtotal_cents: number;
          discount_cents: number;
          subtotal_cents: number;
          vat_cents: number;
          total_cents: number;
        };
        Relationships: [];
      };

      /**
       * Le solde d'une facture de vente, calculé depuis ses règlements. Les
       * avoirs n'y figurent pas. `remaining_cents` vaut 0 dès que la facture
       * n'est plus « émise » ou « envoyée » ; `settled_without_ledger` signale
       * une facture payée avant le suivi des règlements.
       */
      invoice_balances: {
        Row: {
          invoice_id: string;
          organization_id: string;
          status: InvoiceStatus;
          document_type: InvoiceDocumentType;
          due_date: string | null;
          total_cents: number;
          paid_cents: number;
          remaining_cents: number;
          payment_count: number;
          last_paid_on: string | null;
          settled_without_ledger: boolean;
          partially_paid: boolean;
          overdue: boolean;
          /** Imputations de crédits client. Le reste dû les déduit. */
          allocated_cents: number;
        };
        Relationships: [];
      };

      /** Le solde d'un crédit client, calculé. */
      customer_credit_balances: {
        Row: {
          credit_id: string;
          organization_id: string;
          customer_id: string;
          origin: CustomerCreditOrigin;
          credit_note_id: string | null;
          amount_cents: number;
          allocated_cents: number;
          refunded_cents: number;
          remaining_cents: number;
          settled: boolean;
          created_at: string;
        };
        Relationships: [];
      };

      /** L'encours par client : ce qu'il doit, ce qu'on lui doit. */
      customer_accounts: {
        Row: {
          customer_id: string;
          organization_id: string;
          invoiced_cents: number;
          outstanding_cents: number;
          overdue_cents: number;
          credits_remaining_cents: number;
          net_position_cents: number;
        };
        Relationships: [];
      };

      /**
       * Une journée de travail par membre, calculée : segments d'intervention
       * (`work` clos) et temps hors intervention, découpés à minuit dans le
       * fuseau de l'organisation. Un segment ouvert ne compte pas. Seules les
       * journées avec du temps existent ; `timesheet_month` donne le calendrier
       * complet. Chacun voit les siennes, `timesheet.view_all` voit tout.
       */
      timesheet_days: {
        Row: {
          organization_id: string;
          member_id: string;
          /** AAAA-MM-JJ, dans le fuseau de l'organisation. */
          day: string;
          intervention_minutes: number;
          other_minutes: number;
          total_minutes: number;
          /** Un congé validé couvre ce jour. */
          on_leave: boolean;
        };
        Relationships: [];
      };

      /**
       * La semaine ISO (lundi) par membre, comparée au contrat
       * (`organization_members.weekly_hours`, sinon `organizations.weekly_hours`).
       * Le dépassement est une durée, pas une paie : aucune majoration ici.
       */
      timesheet_weeks: {
        Row: {
          organization_id: string;
          member_id: string;
          /** Le lundi, AAAA-MM-JJ. */
          week_start: string;
          intervention_minutes: number;
          other_minutes: number;
          total_minutes: number;
          contract_minutes: number;
          overtime_minutes: number;
          /** Jours travaillés de la semaine qui tombent aussi sur un congé validé. */
          leave_days_touched: number;
        };
        Relationships: [];
      };

      /**
       * Ventilation de la TVA par taux, exigee par EN 16931 : plusieurs lignes
       * par facture. L'arrondi se fait sur la somme des bases d'un meme taux,
       * jamais ligne a ligne — sommer des lignes arrondies ferait deriver le
       * total de quelques centimes, assez pour qu'un controle rejette la
       * facture.
       */
      invoice_vat_breakdown: {
        Row: {
          invoice_id: string;
          organization_id: string;
          vat_rate: number;
          vat_category: VatCategory;
          base_cents: number;
          vat_cents: number;
        };
        Relationships: [];
      };
    };

    Functions: {
      configure_document_numbering: {
        Args: {
          p_organization_id: string;
          p_document_kind: DocumentKind;
          p_first_number: number;
          p_format: DocumentNumberingFormat;
        };
        Returns: Database['public']['Tables']['document_numbering_settings']['Row'];
      };
      // -----------------------------------------------------------------------
      // Portail client — lectures explicites, réservées aux contacts du portail.
      // Chaque fonction renvoie zéro ligne (ou NULL) hors session portail.
      // -----------------------------------------------------------------------
      portal_my_context: {
        Args: Record<string, never>;
        Returns: PortalContext[];
      };
      portal_touch_last_seen: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      portal_list_missions: {
        Args: Record<string, never>;
        Returns: PortalMission[];
      };
      portal_mission_detail: {
        Args: { p_mission_id: string };
        Returns: Json;
      };
      portal_list_quotes: {
        Args: Record<string, never>;
        Returns: PortalQuote[];
      };
      portal_quote_detail: {
        Args: { p_quote_id: string };
        Returns: Json;
      };
      portal_respond_quote: {
        Args: { p_quote_id: string; p_decision: 'accepted' | 'refused' };
        Returns: Json;
      };
      portal_list_invoices: {
        Args: Record<string, never>;
        Returns: PortalInvoice[];
      };
      portal_list_documents: {
        Args: Record<string, never>;
        Returns: PortalDocument[];
      };
      portal_can_read_file: {
        Args: { p_bucket: string; p_path: string };
        Returns: boolean;
      };
      link_invoice_customer: {
        Args: { p_invoice_id: string; p_customer_id: string };
        Returns: undefined;
      };
      link_quote_customer: {
        Args: { p_quote_id: string; p_customer_id: string };
        Returns: undefined;
      };
      can_manage_einvoicing_connection: {
        Args: { p_organization_id: string };
        Returns: boolean;
      };
      can_transmit_invoice: {
        Args: { p_invoice_id: string };
        Returns: boolean;
      };
      save_invoice_draft: {
        Args: { p_invoice_id: string; p_expected_updated_at: string; p_patch: Json; p_items: Json };
        Returns: Database['public']['Tables']['invoices']['Row'];
      };
      create_full_credit_note_draft: {
        Args: { p_invoice_id: string; p_expected_updated_at: string; p_reason: string };
        Returns: Database['public']['Tables']['invoices']['Row'];
      };
      create_credit_note_draft: {
        Args: {
          p_invoice_id: string;
          p_expected_updated_at: string;
          p_reason: string;
          p_scope: 'full' | 'partial';
          p_lines: Json;
        };
        Returns: Database['public']['Tables']['invoices']['Row'];
      };
      get_creditable_invoice_lines: {
        Args: { p_invoice_id: string };
        Returns: Array<{
          invoice_item_id: string;
          description: string;
          unit: string;
          unit_price_cents: number;
          vat_rate: number;
          vat_category: VatCategory;
          vat_exemption_reason: string | null;
          line_position: number;
          original_quantity: number;
          credited_quantity: number;
          available_quantity: number;
        }>;
      };
      save_full_credit_note_draft: {
        Args: {
          p_invoice_id: string;
          p_expected_updated_at: string;
          p_reason: string;
          p_due_date: string;
          p_payment_terms: string;
        };
        Returns: Database['public']['Tables']['invoices']['Row'];
      };
      issue_invoice: {
        Args: { p_invoice_id: string; p_expected_updated_at: string };
        Returns: Database['public']['Tables']['invoices']['Row'];
      };
      /**
       * Le seul chemin pour encaisser. `p_amount_cents` absent = ce qui manque
       * au livre (total − encaissé) : c'est « Marquer payée ».
       */
      record_payment: {
        Args: {
          p_invoice_id: string;
          p_amount_cents?: number | null;
          p_paid_on?: string;
          p_method?: PaymentMethod;
          p_reference?: string | null;
          p_note?: string | null;
          /** Porte l'excédent au crédit du client (fiche rattachée exigée). Sans lui : refus. */
          p_accept_overpayment?: boolean;
        };
        Returns: Database['public']['Tables']['invoice_payments']['Row'];
      };
      /** Imputer un crédit sur une facture du même client. Sans montant : le plus petit des deux restes. */
      allocate_credit: {
        Args: {
          p_credit_id: string;
          p_invoice_id: string;
          p_amount_cents?: number | null;
          p_allocated_on?: string;
        };
        Returns: Database['public']['Tables']['credit_allocations']['Row'];
      };
      /** Rembourser un crédit. Sans montant : tout le reste. */
      refund_credit: {
        Args: {
          p_credit_id: string;
          p_amount_cents?: number | null;
          p_paid_on?: string;
          p_method?: PaymentMethod;
          p_reference?: string | null;
          p_note?: string | null;
        };
        Returns: Database['public']['Tables']['credit_refunds']['Row'];
      };
      /**
       * Enregistre une page — dernier enregistré gagne, avec garde : refusé
       * (`serialization_failure`) si `updated_at` a changé depuis l'ouverture.
       */
      /** Ce qui gêne l'affectation d'un membre sur une fenêtre : missions occupantes, congés validés. */
      mission_conflicts: {
        Args: {
          p_member_id: string;
          p_start: string;
          p_end: string | null;
          p_exclude_mission_id?: string | null;
        };
        Returns: {
          kind: 'mission' | 'leave';
          mission_id: string | null;
          reference: string | null;
          title: string | null;
          starts_at: string;
          ends_at: string | null;
          leave_id: string | null;
          leave_type: LeaveType | null;
        }[];
      };
      /** Lance le générateur de récurrences pour une organisation (planning.manage). */
      run_recurring_tasks: {
        Args: { p_organization_id: string; p_horizon_days?: number };
        Returns: { created: number; skipped: number }[];
      };
      save_workspace_page: {
        Args: {
          p_page_id: string;
          p_expected_updated_at: string;
          p_title: string;
          p_content: TiptapDocument;
        };
        Returns: Database['public']['Tables']['workspace_pages']['Row'];
      };

      // -----------------------------------------------------------------------
      // Feuille d'heures — 20261002090000_feuille_heures.sql
      // -----------------------------------------------------------------------

      /**
       * Le mois complet, un enregistrement par membre actif et par jour —
       * travaillé, vide ou en congé. Chacun n'obtient que les siens sans
       * `timesheet.view_all`. C'est la source de l'export : le fichier se
       * fabrique côté client.
       */
      timesheet_month: {
        Args: { p_organization_id: string; p_month: string };
        Returns: {
          member_id: string;
          day: string;
          intervention_minutes: number;
          other_minutes: number;
          total_minutes: number;
          on_leave: boolean;
          leave_type: LeaveType | null;
          closed: boolean;
        }[];
      };
      /**
       * Fige le mois d'un membre (`timesheet.manage`) : refuse le mois en
       * cours, un chronomètre encore ouvert sur le mois, une clôture déjà
       * active. Journalisé.
       */
      close_timesheet_month: {
        Args: {
          p_organization_id: string;
          p_member_id: string;
          p_month: string;
          p_note?: string | null;
        };
        Returns: Database['public']['Tables']['timesheet_closures']['Row'];
      };
      /** Rouvre une clôture (`timesheet.manage`). Journalisé ; la clôture reste en historique. */
      reopen_timesheet_month: {
        Args: { p_closure_id: string; p_note?: string | null };
        Returns: Database['public']['Tables']['timesheet_closures']['Row'];
      };
      /**
       * Ferme tout chronomètre du compte (intervention comprise) et ouvre un
       * temps hors intervention. Le pendant de `switch_intervention_time_entry`.
       */
      start_work_time: {
        Args: { p_organization_id: string; p_kind: WorkTimeKind; p_note?: string | null };
        Returns: Database['public']['Tables']['work_time_entries']['Row'];
      };
      /** Ferme le temps hors intervention en cours du compte ; `null` s'il n'y en avait pas. */
      stop_work_time: {
        Args: Record<string, never>;
        Returns: Database['public']['Tables']['work_time_entries']['Row'] | null;
      };

      // -----------------------------------------------------------------------
      // Workspace v2 — 20261003090000_workspace_v2.sql
      // -----------------------------------------------------------------------

      /** Mon espace personnel, créé à la première demande, rouvert s'il était archivé. */
      ensure_personal_workspace_space: {
        Args: { p_organization_id: string };
        Returns: Database['public']['Tables']['workspace_spaces']['Row'];
      };
      /** J'ai ouvert cette page (récentes, 50 au plus). Refusé sur une page invisible. */
      touch_workspace_page: {
        Args: { p_page_id: string };
        Returns: undefined;
      };
      /** Une page à partir d'un modèle (titre, icône, contenu). RLS d'édition appliquée. */
      create_page_from_template: {
        Args: {
          p_template_id: string;
          p_space_id: string;
          p_parent_page_id?: string | null;
          p_title?: string | null;
        };
        Returns: Database['public']['Tables']['workspace_pages']['Row'];
      };
      /** Le fichier est déposé : la transcription peut partir (auteur seul). */
      submit_workspace_recording: {
        Args: { p_recording_id: string; p_size_bytes?: number | null };
        Returns: Database['public']['Tables']['workspace_recordings']['Row'];
      };
      /** Minutes de transcription du mois : consommées, plafond, reste. Membres seulement. */
      transcription_quota_status: {
        Args: { p_organization_id: string };
        Returns: {
          used_minutes: number;
          limit_minutes: number | null;
          remaining_minutes: number | null;
          unlimited: boolean;
        }[];
      };
      /** Des noms déjà dans les données de l'organisation (clients, sites, matériel, membres, communes), à proposer au dictionnaire. */
      suggest_organization_vocabulary: {
        Args: { p_organization_id: string };
        Returns: { term: string; type: VocabularyType; already_present: boolean }[];
      };
      /** Recherche plein texte (français) dans les pages visibles. Syntaxe « web ». */
      search_workspace_pages: {
        Args: { p_organization_id: string; p_query: string; p_limit?: number };
        Returns: {
          id: string;
          space_id: string;
          title: string;
          icon: string | null;
          /** Extrait avec « » autour des mots trouvés. */
          snippet: string;
          rank: number;
          updated_at: string;
        }[];
      };
      /**
       * Enregistre un mouvement et met à jour la quantité, dans la même
       * transaction.
       *
       * Le faire en deux appels laisserait une fenêtre où le journal et l'état
       * divergent, et deux techniciens servant le même article au même instant
       * perdraient une décrémentation. La fonction est `security invoker` : les
       * policies de `stock_consumables` et `stock_movements` s'appliquent
       * normalement.
       */
      record_stock_movement: {
        Args: {
          p_consumable_id: string;
          p_type: StockMovementType;
          p_quantity: number;
          p_reason?: string;
          p_technician_id?: string | null;
          p_technician_name?: string | null;
          p_intervention_ref?: string | null;
          p_location_from?: string | null;
          p_location_to?: string | null;
        };
        Returns: Database['public']['Tables']['stock_movements']['Row'];
      };

      /**
       * Pointe une livraison et fait entrer la marchandise en stock, dans la
       * même transaction.
       *
       * `p_lines` est un objet `{ "<id de ligne>": <quantité reçue MAINTENANT> }` :
       * un incrément, pas un cumul. La quantité est plafonnée à ce qui reste dû.
       *
       * L'écrire en deux appels — pointer, puis mouvementer le stock — laissait
       * une fenêtre où le bon de commande et le stock divergeaient, que
       * l'ancienne « réconciliation » rattrapait en cherchant la référence de
       * commande dans le TEXTE du motif de mouvement.
       */
      receive_purchase_order: {
        Args: {
          p_order_id: string;
          p_lines?: Record<string, number>;
          p_delivery_notes?: string | null;
        };
        Returns: Database['public']['Tables']['purchase_orders']['Row'];
      };

      /** Solde toutes les lignes restantes d'une commande d'un seul coup. */
      receive_purchase_order_fully: {
        Args: { p_order_id: string };
        Returns: Database['public']['Tables']['purchase_orders']['Row'];
      };

      /**
       * Accepte une invitation et crée l'appartenance. Renvoie l'identifiant de
       * l'organisation rejointe.
       *
       * Passe par une fonction plutôt que par un INSERT : l'invité n'est pas
       * encore membre, il n'a donc aucun droit d'écriture sur
       * `organization_members`.
       */
      accept_organization_invitation: {
        Args: { p_token: string };
        Returns: string;
      };

      /**
       * Décompte d'une période de congé, jour par jour.
       *
       * Expose le MÊME moteur que le trigger `leave_requests_days_count` :
       * l'aperçu affiché et le total enregistré ne peuvent pas diverger, ce
       * qu'un second calcul en TypeScript aurait fini par produire.
       *
       * Ne lit aucune table et ne reçoit aucune donnée d'entreprise.
       */
      /**
       * Situation de facturation d'une organisation.
       *
       * Le SERVEUR calcule sièges et montant ; l'interface affiche. Un calcul
       * en TypeScript à côté finirait par diverger — et ici, la divergence se
       * lirait sur une facture.
       */
      /** Lève le drapeau de résiliation ; renvoie la date de fin d'accès. */
      cancel_organization_subscription: {
        Args: { p_organization_id: string };
        Returns: string | null;
      };
      /** Annule une résiliation qui n'a pas encore pris effet. */
      resume_organization_subscription: {
        Args: { p_organization_id: string };
        Returns: undefined;
      };
      organization_billing_summary: {
        Args: { p_organization_id: string };
        Returns: {
          plan_code: string;
          plan_name: string;
          included_seats: number;
          active_seats: number;
          extra_seats: number;
          extra_seat_cents: number;
          base_cents: number;
          total_cents: number;
          max_users: number | null;
          /** Statut de l'abonnement retenu, ou `null` s'il n'y en a aucun. */
          subscription_status: string | null;
          /** Un prestataire encaisse-t-il ? `false` en essai et sur Gratuit. */
          is_billed: boolean;
        }[];
      };

      preview_leave_days: {
        Args: {
          p_start: string;
          p_end: string;
          p_territory?: string;
          p_half_day_start?: boolean;
          p_half_day_end?: boolean;
        };
        Returns: {
          day: string;
          counted: boolean;
          value: number;
          reason: string;
        }[];
      };

      /**
       * Aperçu d'une invitation, avant acceptation.
       *
       * `security definer` : l'invité n'est pas encore membre et ne peut donc
       * pas lire `organizations`. La fonction ne révèle que le nom, le rôle
       * proposé et l'expiration — la connaissance du jeton (UUID v4) tenant
       * lieu d'autorisation. Renvoie zéro ligne pour un jeton inconnu, révoqué,
       * déjà accepté ou expiré : les quatre cas sont indistinguables.
       */
      get_invitation_preview: {
        Args: { p_token: string };
        Returns: {
          organization_name: string;
          invited_role: OrgRole;
          /** L'écran crée le compte : il doit dire pour quelle adresse. */
          invited_email: string;
          expires_at: string;
        }[];
      };

      /**
       * Temps net travaillé, en secondes — somme des seuls segments `work` clos.
       *
       * Passe-plat vers `app.intervention_worked_seconds`, le schéma `app`
       * n'étant pas exposé par PostgREST. Le calcul reste unique : c'est celui
       * qui servira à facturer.
       */
      intervention_worked_seconds: {
        Args: { p_intervention_id: string };
        Returns: number;
      };

      /** Ferme puis ouvre le chronomètre du compte dans une transaction. */
      switch_intervention_time_entry: {
        Args: {
          p_intervention_id: string;
          p_to: TimeEntryKind;
          p_reason?: string | null;
        };
        Returns: Database['public']['Tables']['intervention_time_entries']['Row'];
      };

      /**
       * Agrégats d'activité d'une organisation, sur une période.
       *
       * `security definer` : les compteurs portent sur toute l'organisation,
       * là où `missions_select_scoped` restreint un chef d'équipe à ses seules
       * missions. La fonction vérifie elle-même `statistics.view` et
       * l'entitlement du plan avant la moindre lecture.
       */
      /**
       * Code de la formule d'une organisation dont on est membre.
       *
       * `security definer` : `app.org_plan_code` lit `subscriptions`, que
       * `subscriptions_select_own` réserve à `billing.view`. Un technicien doit
       * pourtant savoir si son entreprise est abonnée — c'est ce qui détermine
       * les écrans auxquels il accède. Seul le CODE sort ; prix, statut et
       * échéance restent derrière la permission de facturation.
       */
      organization_plan_code: {
        Args: { p_organization_id: string };
        Returns: string | null;
      };

      organization_activity_stats: {
        Args: {
          p_organization_id: string;
          p_from?: string | null;
          p_to?: string | null;
        };
        Returns: Json;
      };

      /**
       * Compteurs agrégés du tableau de bord Prospect Radar (module interne).
       * Refuse quiconque n'a pas `prospecting.view` — y compris un client
       * REZO360 authentifié — jamais une ligne de `prospects` en sortie.
       */
      prospecting_dashboard_stats: {
        Args: Record<string, never>;
        Returns: Json;
      };

      /**
       * Analytics du funnel de prospection (Phase 12, §31) : cohorte par
       * date de DÉTECTION, jamais un instantané du statut courant.
       */
      prospecting_analytics: {
        Args: { p_from?: string | null; p_to?: string | null };
        Returns: Json;
      };

      /**
       * Recherche d'organisations REZO360 à lier à un prospect converti
       * (Phase 9). Refuse quiconque n'a pas prospecting.manage ; exclut les
       * organisations déjà liées à un autre prospect.
       */
      prospecting_search_organizations: {
        Args: { p_query?: string };
        Returns: Array<{
          id: string;
          name: string;
          legal_name: string | null;
          registration_number: string | null;
        }>;
      };

      /**
       * Convertit un prospect en client REZO360 : statut, lien vers
       * l'organisation réelle, arrêt des relances en attente — en une seule
       * transaction. Refuse quiconque n'a pas prospecting.manage.
       */
      convert_prospect_to_client: {
        Args: { p_siren: string; p_organization_id: string };
        Returns: undefined;
      };
    };

    Enums: {
      content_status: ContentStatus;
      tool_visibility: ToolVisibility;
      org_role: OrgRole;
      member_status: MemberStatus;
      organization_status: OrganizationStatus;
      invitation_status: InvitationStatus;
      subscription_status: SubscriptionStatus;
      payment_method: PaymentMethod;
      workspace_task_status: WorkspaceTaskStatus;
      recurring_occurrence_status: RecurringOccurrenceStatus;
      customer_credit_origin: CustomerCreditOrigin;
      work_time_kind: WorkTimeKind;
      workspace_task_priority: WorkspaceTaskPriority;
      team_member_role: TeamMemberRole;
      mission_status: MissionStatus;
      mission_priority: MissionPriority;
      intervention_status: InterventionStatus;
      report_status: ReportStatus;
      attachment_kind: AttachmentKind;
      time_entry_kind: TimeEntryKind;
      equipment_category: EquipmentCategory;
      equipment_status: EquipmentStatus;
      equipment_condition: EquipmentCondition;
      quote_status: QuoteStatus;
      note_category: NoteCategory;
      ai_document_status: AiDocumentStatus;
      invoice_transmission_status: InvoiceTransmissionStatus;
      einvoicing_connection_status: EinvoicingConnectionStatus;
      prospect_status: ProspectStatus;
    };

    CompositeTypes: Record<never, never>;
  };
}

/** Raccourcis de lecture : `Tables<'tools'>` plutôt que le chemin complet. */
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
