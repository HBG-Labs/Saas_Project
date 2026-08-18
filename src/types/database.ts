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

export type EquipmentCategory = 'optique' | 'electricite' | 'radio' | 'securite' | 'autre';
export type EquipmentStatus = 'available' | 'assigned' | 'maintenance' | 'expired';
export type EquipmentCondition = 'neuf' | 'bon_etat' | 'a_reviser';

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'refused' | 'expired';

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
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'date';

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
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string | null;
          avatar_url?: string | null;
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
          /** Imposé à `auth.uid()` par la policy `organizations_insert_self`. */
          created_by: string;
        };
        Update: {
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
        };
        Update: {
          role?: OrgRole;
          status?: MemberStatus;
          job_title?: string | null;
          phone?: string | null;
          joined_at?: string | null;
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
          status?: ContentStatus;
          created_by?: string | null;
        };
        Update: Partial<Omit<Database['public']['Tables']['customers']['Insert'], 'organization_id'>>;
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
        Update: { caption?: string | null; kind?: AttachmentKind };
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
          valid_until: string | null;
          created_by: string | null;
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
          valid_until?: string | null;
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
      // Bloc-notes personnel
      // =======================================================================
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
          subtotal_cents: number;
          vat_cents: number;
          total_cents: number;
        };
        Relationships: [];
      };
    };

    Functions: {
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
    };

    Enums: {
      content_status: ContentStatus;
      tool_visibility: ToolVisibility;
      org_role: OrgRole;
      member_status: MemberStatus;
      organization_status: OrganizationStatus;
      invitation_status: InvitationStatus;
      subscription_status: SubscriptionStatus;
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
