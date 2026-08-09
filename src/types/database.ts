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

export interface Database {
  public: {
    Tables: {
      // =======================================================================
      // Socle utilisateur
      // =======================================================================
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
          /** Imposé à `auth.uid()` par la policy `organizations_insert_self`. */
          created_by: string;
        };
        Update: {
          name?: string;
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
      plans: {
        Row: {
          code: string;
          name: string;
          description: string | null;
          price_monthly_cents: number;
          price_annual_cents: number;
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
          category_id: string | null;
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
    };

    Views: Record<never, never>;

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
