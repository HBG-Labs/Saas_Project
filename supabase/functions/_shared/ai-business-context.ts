import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.112.2';

import {
  selectKnowledgeDomains,
  type AiDomainKey,
  type AiKnowledgeDomain,
} from './ai-domain-catalog.ts';

const DEFAULT_ROW_LIMIT = 30;
const COMPLETE_LIST_LIMIT = 250;
const AGGREGATE_PAGE_SIZE = 1_000;
const AGGREGATE_HARD_LIMIT = 10_000;

type Scope =
  | 'organization'
  | 'organization_user'
  | 'user'
  | 'profile'
  | 'plan'
  | 'industry'
  | 'public';

interface SourceSpec {
  table: string;
  fields: string;
  scope: Scope;
  order?: string;
  ascending?: boolean;
  aggregateFields?: readonly string[];
  /** Relation PostgREST utilisée par les tables enfants sans organization_id. */
  organizationRelation?: string;
  /** Sélection minimale à conserver pour que le filtre de relation fonctionne aussi sur les agrégats. */
  organizationRelationSelect?: string;
}

const DOMAIN_SOURCES: Partial<Record<AiDomainKey, readonly SourceSpec[]>> = {
  organization: [
    {
      table: 'organizations',
      fields:
        'id,name,legal_name,registration_number,vat_number,email,phone,address_line1,address_line2,postal_code,city,country,status,industry,default_vat_rate,quote_payment_terms,quote_payment_method,legal_form,ape_code,share_capital_cents,rcs_city,iban,bic,vat_regime,holiday_territory,plan_code,created_at,updated_at',
      scope: 'organization',
    },
    {
      table: 'industries',
      fields: 'code,label,description,status,vocabulary',
      scope: 'industry',
    },
  ],
  profile: [
    { table: 'profiles', fields: 'id,display_name,avatar_id,created_at,updated_at', scope: 'profile' },
    {
      table: 'profile_details',
      fields: 'user_id,phone,zone,certifications,equipments,created_at,updated_at',
      scope: 'user',
    },
  ],
  subscription: [
    {
      table: 'subscriptions',
      fields:
        'id,plan_code,status,current_period_start,current_period_end,trial_ends_at,canceled_at,cancel_at_period_end,provider,created_at,updated_at',
      scope: 'organization',
      order: 'created_at',
    },
    {
      table: 'plans',
      fields:
        'code,name,description,price_monthly_cents,price_annual_cents,extra_user_price_cents,max_users,currency,is_organization_plan,sort_order,status',
      scope: 'plan',
    },
    { table: 'plan_features', fields: 'plan_code,feature_key,limit_value', scope: 'plan' },
  ],
  members: [
    {
      table: 'organization_members',
      fields:
        'id,user_id,role,status,job_title,phone,joined_at,created_at,updated_at,profile:profiles(display_name,avatar_id)',
      scope: 'organization',
      order: 'created_at',
      ascending: true,
      aggregateFields: ['role', 'status', 'joined_at', 'created_at'],
    },
    {
      table: 'organization_invitations',
      fields: 'id,email,role,status,expires_at,accepted_at,created_at',
      scope: 'organization',
      order: 'created_at',
      aggregateFields: ['role', 'status', 'expires_at', 'created_at'],
    },
    { table: 'role_permissions', fields: 'role,permission', scope: 'public' },
  ],
  teams: [
    {
      table: 'teams',
      fields: 'id,name,slug,description,color,manager_id,status,created_by,created_at,updated_at',
      scope: 'organization',
      order: 'created_at',
      aggregateFields: ['status', 'created_at'],
    },
    {
      table: 'team_members',
      fields: 'id,team_id,member_id,role,joined_at,team:teams!inner(organization_id,name)',
      scope: 'public',
      organizationRelation: 'team',
      organizationRelationSelect: 'team:teams!inner(organization_id)',
      aggregateFields: ['role', 'joined_at'],
    },
  ],
  customers: [
    {
      table: 'customers',
      fields:
        'id,reference,name,legal_name,registration_number,vat_number,email,phone,address_line1,address_line2,postal_code,city,country,notes,customer_type,status,created_at,updated_at',
      scope: 'organization',
      order: 'created_at',
      ascending: true,
      aggregateFields: ['status', 'customer_type', 'created_at'],
    },
    {
      table: 'customer_contacts',
      fields:
        'id,customer_id,first_name,last_name,role_label,email,phone,is_primary,notes,created_at,updated_at',
      scope: 'organization',
      order: 'created_at',
      aggregateFields: ['is_primary', 'created_at'],
    },
    {
      table: 'sites',
      fields:
        'id,customer_id,name,code,address_line1,address_line2,postal_code,city,country,latitude,longitude,access_notes,contact_id,status,created_at,updated_at',
      scope: 'organization',
      order: 'created_at',
      aggregateFields: ['status', 'city', 'created_at'],
    },
  ],
  missions: [
    {
      table: 'missions',
      fields:
        'id,reference,title,description,intervention_type_id,customer_id,site_id,priority,status,assigned_team_id,assigned_user_id,scheduled_start,scheduled_end,actual_start,actual_end,location_label,address_line1,address_line2,postal_code,city,country,latitude,longitude,customer_name,customer_contact,customer_phone,customer_email,notes,created_at,updated_at',
      scope: 'organization',
      order: 'created_at',
      aggregateFields: [
        'status',
        'priority',
        'customer_id',
        'site_id',
        'scheduled_start',
        'scheduled_end',
        'actual_start',
        'actual_end',
        'created_at',
      ],
    },
    {
      table: 'mission_assignments',
      fields:
        'id,mission_id,team_id,member_id,assigned_by,assigned_at,unassigned_at,accepted_at,declined_at,decline_reason,mission:missions!inner(organization_id,reference,title)',
      scope: 'public',
      organizationRelation: 'mission',
      organizationRelationSelect: 'mission:missions!inner(organization_id)',
      aggregateFields: ['assigned_at', 'unassigned_at', 'accepted_at', 'declined_at'],
    },
    {
      table: 'mission_status_events',
      fields:
        'id,mission_id,from_status,to_status,actor_id,reason,created_at,mission:missions!inner(organization_id,reference,title)',
      scope: 'public',
      organizationRelation: 'mission',
      organizationRelationSelect: 'mission:missions!inner(organization_id)',
      order: 'created_at',
      aggregateFields: ['from_status', 'to_status', 'created_at'],
    },
    {
      table: 'mission_status_transitions',
      fields: 'from_status,to_status,required_permission,assignee_only,description',
      scope: 'public',
    },
  ],
  interventions: [
    {
      table: 'interventions',
      fields:
        'id,mission_id,technician_id,status,start_time,end_time,start_latitude,start_longitude,notes,created_at,updated_at',
      scope: 'organization',
      order: 'created_at',
      aggregateFields: ['status', 'technician_id', 'start_time', 'end_time', 'created_at'],
    },
    {
      table: 'intervention_time_entries',
      fields:
        'id,intervention_id,technician_id,technician_user_id,kind,started_at,ended_at,reason,created_at',
      scope: 'organization',
      order: 'started_at',
      aggregateFields: ['kind', 'technician_id', 'started_at', 'ended_at'],
    },
    {
      table: 'intervention_reports',
      fields:
        'id,intervention_id,technician_id,work_description,observations,materials_used,tools_used,customer_signature_name,status,submitted_at,reviewed_at,reviewed_by,rejection_reason,created_at,updated_at',
      scope: 'organization',
      order: 'created_at',
      aggregateFields: ['status', 'technician_id', 'submitted_at', 'reviewed_at', 'created_at'],
    },
    {
      table: 'intervention_attachments',
      fields: 'id,intervention_id,kind,file_name,mime_type,size_bytes,caption,uploaded_by,created_at',
      scope: 'organization',
      order: 'created_at',
      aggregateFields: ['kind', 'mime_type', 'size_bytes', 'created_at'],
    },
    {
      table: 'intervention_form_responses',
      fields: 'id,intervention_id,form_template_id,values,completed_at,created_at,updated_at',
      scope: 'organization',
      order: 'created_at',
      aggregateFields: ['completed_at', 'created_at'],
    },
    {
      table: 'intervention_checklist_responses',
      fields: 'id,intervention_id,checklist_template_id,checked,completed_at,created_at,updated_at',
      scope: 'organization',
      order: 'created_at',
      aggregateFields: ['completed_at', 'created_at'],
    },
  ],
  planning: [
    {
      table: 'leave_requests',
      fields:
        'id,member_id,type,start_date,end_date,days_count,half_day_start,half_day_end,reason,status,requested_at,reviewed_by,reviewed_at,review_note,created_at,updated_at',
      scope: 'organization',
      order: 'start_date',
      ascending: true,
      aggregateFields: ['type', 'status', 'member_id', 'start_date', 'end_date', 'days_count'],
    },
    {
      table: 'leave_balances',
      fields:
        'id,member_id,year,paid_leave_acquired,rtt_acquired,recovery_hours,created_at,updated_at',
      scope: 'organization',
      aggregateFields: ['year', 'paid_leave_acquired', 'rtt_acquired', 'recovery_hours'],
    },
    {
      table: 'recurring_tasks',
      fields:
        'id,title,frequency,next_date,customer_id,site_id,assigned_member_id,intervention_type_id,estimated_minutes,notes,is_active,created_at,updated_at',
      scope: 'organization',
      order: 'next_date',
      ascending: true,
      aggregateFields: ['frequency', 'next_date', 'assigned_member_id', 'estimated_minutes', 'is_active'],
    },
    {
      table: 'technician_locations',
      fields:
        'member_id,latitude,longitude,accuracy_m,heading,speed_kmh,battery_pct,presence,vehicle_plate,recorded_at,updated_at',
      scope: 'organization',
      order: 'recorded_at',
      aggregateFields: ['presence', 'recorded_at'],
    },
  ],
  stock: [
    {
      table: 'stock_consumables',
      fields:
        'id,reference,name,category,unit,quantity_in_stock,min_threshold,unit_price_eur,selling_price_eur,location,supplier,notes,created_at,updated_at',
      scope: 'organization',
      order: 'created_at',
      aggregateFields: [
        'category',
        'unit',
        'quantity_in_stock',
        'min_threshold',
        'unit_price_eur',
        'selling_price_eur',
        'created_at',
      ],
    },
    {
      table: 'stock_movements',
      fields:
        'id,consumable_id,consumable_name,consumable_reference,type,quantity,reason,technician_id,technician_name,intervention_ref,location_from,location_to,occurred_at,created_at',
      scope: 'organization',
      order: 'occurred_at',
      aggregateFields: ['type', 'consumable_id', 'quantity', 'technician_id', 'occurred_at'],
    },
  ],
  equipment: [
    {
      table: 'equipment',
      fields:
        'id,name,brand,serial_number,category,category_id,status,condition,assigned_member_id,last_calibration,next_calibration,notes,created_at,updated_at',
      scope: 'organization',
      order: 'created_at',
      aggregateFields: ['category', 'status', 'condition', 'assigned_member_id', 'next_calibration'],
    },
    {
      table: 'equipment_categories',
      fields: 'id,industry_code,code,label,icon,sort_order,status',
      scope: 'industry',
    },
  ],
  vehicles: [
    {
      table: 'vehicles',
      fields:
        'id,plate,brand,model,type,fuel,status,mileage,assigned_member_id,next_ct_date,next_revision_date,next_revision_mileage,insurance_expiry_date,notes,created_at,updated_at',
      scope: 'organization',
      order: 'created_at',
      aggregateFields: [
        'type',
        'fuel',
        'status',
        'mileage',
        'next_ct_date',
        'next_revision_date',
        'next_revision_mileage',
        'insurance_expiry_date',
      ],
    },
    {
      table: 'vehicle_maintenance_records',
      fields:
        'id,vehicle_id,performed_on,type,description,mileage,cost_cents,performed_by,created_at,vehicle:vehicles!inner(organization_id,plate,brand,model)',
      scope: 'public',
      organizationRelation: 'vehicle',
      organizationRelationSelect: 'vehicle:vehicles!inner(organization_id)',
      order: 'performed_on',
      aggregateFields: ['performed_on', 'type', 'mileage', 'cost_cents'],
    },
  ],
  purchases: [
    {
      table: 'suppliers',
      fields:
        'id,name,code,contact_name,email,phone,address,city,postal_code,siret,vat_number,website,default_payment_terms,notes,created_at,updated_at',
      scope: 'organization',
      order: 'created_at',
      aggregateFields: ['city', 'created_at'],
    },
    {
      table: 'purchase_orders',
      fields:
        'id,reference,supplier_id,supplier_name,supplier_email,supplier_phone,supplier_address,status,order_date,expected_delivery_date,received_date,mission_id,mission_ref,tax_rate,notes,delivery_notes,created_at,updated_at',
      scope: 'organization',
      order: 'created_at',
      aggregateFields: [
        'status',
        'supplier_id',
        'order_date',
        'expected_delivery_date',
        'received_date',
        'tax_rate',
      ],
    },
    {
      table: 'purchase_order_items',
      fields:
        'id,purchase_order_id,consumable_id,reference,description,unit,quantity_ordered,quantity_received,unit_price_eur,position,created_at,purchase_order:purchase_orders!inner(organization_id,reference,status)',
      scope: 'public',
      organizationRelation: 'purchase_order',
      organizationRelationSelect: 'purchase_order:purchase_orders!inner(organization_id)',
      aggregateFields: ['quantity_ordered', 'quantity_received', 'unit_price_eur', 'created_at'],
    },
  ],
  quotes: [
    {
      table: 'quotes',
      fields:
        'id,reference,title,customer_id,site_id,customer_name,site_name,vat_rate,status,notes,valid_until,created_at,updated_at',
      scope: 'organization',
      order: 'created_at',
      aggregateFields: ['status', 'customer_id', 'vat_rate', 'valid_until', 'created_at'],
    },
    {
      table: 'quote_items',
      fields: 'id,quote_id,description,unit,quantity,unit_price_cents,position,created_at',
      scope: 'organization',
      aggregateFields: ['quote_id', 'quantity', 'unit_price_cents', 'created_at'],
    },
    {
      table: 'quote_totals',
      fields: 'quote_id,subtotal_cents,vat_cents,total_cents',
      scope: 'organization',
      aggregateFields: ['subtotal_cents', 'vat_cents', 'total_cents'],
    },
    {
      table: 'quote_templates',
      fields: 'id,label,unit,unit_price_cents,sort_order,status,created_at,updated_at',
      scope: 'organization',
      aggregateFields: ['unit_price_cents', 'status'],
    },
  ],
  invoices: [
    {
      table: 'invoices',
      fields:
        'id,reference,document_type,corrects_invoice_id,credit_note_scope,credit_note_reason,corrected_invoice_reference,corrected_invoice_issued_at,title,customer_id,site_id,quote_id,customer_name,customer_legal_name,customer_registration_number,customer_vat_number,customer_address_line1,customer_address_line2,customer_postal_code,customer_city,customer_country,customer_type,service_date,operation_type,buyer_reference,purchase_order_reference,delivery_address_line1,delivery_address_line2,delivery_postal_code,delivery_city,delivery_country,early_payment_terms,late_payment_terms,vat_on_debits,site_name,currency,status,issued_at,due_date,payment_terms,payment_method,notes,seller_name,seller_legal_name,seller_registration_number,seller_vat_number,seller_legal_form,seller_ape_code,seller_share_capital_cents,seller_rcs_city,seller_address_line1,seller_address_line2,seller_postal_code,seller_city,seller_country,seller_iban,seller_bic,seller_vat_regime,created_at,updated_at',
      scope: 'organization',
      order: 'created_at',
      aggregateFields: [
        'document_type',
        'status',
        'customer_id',
        'service_date',
        'issued_at',
        'due_date',
        'created_at',
      ],
    },
    {
      table: 'invoice_items',
      fields:
        'id,invoice_id,source_invoice_item_id,description,unit,quantity,unit_price_cents,vat_rate,vat_category,vat_exemption_reason,position,created_at',
      scope: 'organization',
      aggregateFields: ['invoice_id', 'quantity', 'unit_price_cents', 'vat_rate', 'vat_category'],
    },
    {
      table: 'invoice_totals',
      fields: 'invoice_id,subtotal_cents,vat_cents,total_cents',
      scope: 'organization',
      aggregateFields: ['subtotal_cents', 'vat_cents', 'total_cents'],
    },
    {
      table: 'invoice_vat_breakdown',
      fields: 'invoice_id,vat_rate,vat_category,base_cents,vat_cents',
      scope: 'organization',
      aggregateFields: ['vat_rate', 'vat_category', 'base_cents', 'vat_cents'],
    },
  ],
  einvoicing: [
    {
      table: 'invoice_electronic_documents',
      fields: 'invoice_id,format,profile,generator_version,byte_size,generated_at',
      scope: 'organization',
      order: 'generated_at',
      aggregateFields: ['format', 'profile', 'byte_size', 'generated_at'],
    },
    {
      table: 'invoice_transmissions',
      fields:
        'id,invoice_id,provider_code,status,provider_submission_id,provider_environment,attempt_count,last_attempt_at,next_attempt_at,submitted_at,delivered_at,completed_at,last_error_code,last_error_message,created_at,updated_at',
      scope: 'organization',
      order: 'created_at',
      aggregateFields: [
        'provider_code',
        'status',
        'provider_environment',
        'attempt_count',
        'last_attempt_at',
        'next_attempt_at',
      ],
    },
    {
      table: 'invoice_transmission_events',
      fields:
        'id,transmission_id,invoice_id,source,event_type,normalized_status,provider_status_code,message,occurred_at,recorded_at',
      scope: 'organization',
      order: 'occurred_at',
      aggregateFields: ['source', 'event_type', 'normalized_status', 'occurred_at'],
    },
    {
      table: 'einvoicing_provider_connections',
      // Les jetons chiffrés, l'état OAuth et les empreintes techniques sont
      // volontairement exclus, même pour le propriétaire.
      fields:
        'organization_id,provider_code,status,provider_company_id,provider_environment,company_verification_status,user_identity_verification_status,access_token_expires_at,connected_at,last_verified_at,last_error_code,last_error_message,updated_at',
      scope: 'organization',
    },
  ],
  general_documents: [
    {
      table: 'document_folders',
      fields: 'id,parent_folder_id,name,created_by,created_at,updated_at',
      scope: 'organization',
      order: 'created_at',
    },
    {
      table: 'organization_documents',
      // Le chemin Storage est un détail interne, jamais une connaissance métier.
      fields:
        'id,folder_id,uploaded_by,name,original_filename,mime_type,file_size,description,category,created_at,updated_at',
      scope: 'organization',
      order: 'created_at',
      aggregateFields: ['folder_id', 'mime_type', 'file_size', 'category', 'created_at'],
    },
  ],
  ai_documents: [
    {
      table: 'ai_documents',
      fields:
        'id,title,description,category,filename,mime_type,file_size,status,error_message,uploaded_by,created_at,updated_at',
      scope: 'organization',
      order: 'created_at',
      aggregateFields: ['status', 'category', 'mime_type', 'file_size', 'created_at'],
    },
  ],
  notes: [
    {
      table: 'notes',
      fields: 'id,title,content,category,is_pinned,created_at,updated_at',
      scope: 'organization_user',
      order: 'updated_at',
      aggregateFields: ['category', 'is_pinned', 'created_at', 'updated_at'],
    },
  ],
  analytics: [
    {
      table: 'missions',
      fields: 'id,status,priority,customer_id,created_at,scheduled_start,scheduled_end',
      scope: 'organization',
      aggregateFields: [
        'status',
        'priority',
        'customer_id',
        'created_at',
        'scheduled_start',
        'scheduled_end',
      ],
    },
    {
      table: 'interventions',
      fields: 'id,status,technician_id,start_time,end_time,created_at',
      scope: 'organization',
      aggregateFields: ['status', 'technician_id', 'start_time', 'end_time', 'created_at'],
    },
    {
      table: 'intervention_reports',
      fields: 'id,status,technician_id,submitted_at,reviewed_at,created_at',
      scope: 'organization',
      aggregateFields: ['status', 'technician_id', 'submitted_at', 'reviewed_at', 'created_at'],
    },
    {
      table: 'organization_members',
      fields: 'id,role,status,joined_at,created_at',
      scope: 'organization',
      aggregateFields: ['role', 'status', 'joined_at', 'created_at'],
    },
    {
      table: 'teams',
      fields: 'id,status,created_at',
      scope: 'organization',
      aggregateFields: ['status', 'created_at'],
    },
    {
      table: 'invoice_totals',
      fields: 'invoice_id,subtotal_cents,vat_cents,total_cents',
      scope: 'organization',
      aggregateFields: ['subtotal_cents', 'vat_cents', 'total_cents'],
    },
    {
      table: 'quote_totals',
      fields: 'quote_id,subtotal_cents,vat_cents,total_cents',
      scope: 'organization',
      aggregateFields: ['subtotal_cents', 'vat_cents', 'total_cents'],
    },
  ],
  audit: [
    {
      table: 'audit_logs',
      fields: 'id,user_id,actor_label,action,entity_type,entity_id,metadata,created_at',
      scope: 'organization',
      order: 'created_at',
      aggregateFields: ['user_id', 'action', 'entity_type', 'created_at'],
    },
  ],
  notifications: [
    {
      table: 'user_preferences',
      fields:
        'user_id,notify_new_mission,notify_maintenance_due,notify_stock_low,notify_leave_requests,sms_urgent_alerts,traffic_layer,vehicle_type,gps_refresh_rate,created_at,updated_at',
      scope: 'user',
    },
  ],
  catalog: [
    {
      table: 'categories',
      fields: 'id,slug,name,description,short_description,icon,sort_order,status',
      scope: 'public',
      aggregateFields: ['status'],
    },
    {
      table: 'tools',
      fields:
        'id,slug,category_id,name,description,short_description,keywords,icon,sort_order,status,visibility',
      scope: 'public',
      aggregateFields: ['status', 'visibility', 'category_id'],
    },
  ],
  personal_history: [
    { table: 'favorites', fields: 'user_id,tool_id,created_at', scope: 'user', order: 'created_at' },
    {
      table: 'tool_history',
      fields: 'id,user_id,tool_id,used_at',
      scope: 'user',
      order: 'used_at',
    },
  ],
  training: [
    {
      table: 'training_progress',
      fields: 'id,user_id,course_slug,completed_chapters,created_at,updated_at',
      scope: 'user',
      order: 'updated_at',
    },
  ],
  conversations: [
    {
      table: 'ai_conversations',
      fields: 'id,title,created_at,updated_at',
      scope: 'organization_user',
      order: 'updated_at',
    },
    {
      table: 'ai_usage',
      fields: 'id,request_type,input_tokens,output_tokens,estimated_cost,created_at',
      scope: 'organization_user',
      order: 'created_at',
      aggregateFields: ['request_type', 'input_tokens', 'output_tokens', 'estimated_cost', 'created_at'],
    },
  ],
  industry_forms: [
    { table: 'industries', fields: 'code,label,description,status,vocabulary', scope: 'industry' },
    {
      table: 'intervention_types',
      fields: 'id,industry_code,code,label,description,icon,sort_order,status',
      scope: 'industry',
    },
    {
      table: 'form_templates',
      fields: 'id,intervention_type_id,version,label,description,status,created_at,updated_at',
      scope: 'public',
    },
    {
      table: 'form_fields',
      fields:
        'id,form_template_id,key,label,help,type,required,unit,min_value,max_value,options,sort_order',
      scope: 'public',
    },
    {
      table: 'checklist_templates',
      fields: 'id,intervention_type_id,version,label,description,status,created_at,updated_at',
      scope: 'public',
    },
    {
      table: 'checklist_items',
      fields: 'id,checklist_template_id,code,label,help,required,sort_order',
      scope: 'public',
    },
  ],
};

export interface AiCapabilities {
  role: string;
  planCode: string;
  industry: string | null;
  permissions: ReadonlySet<string>;
  features: ReadonlySet<string>;
}

export interface AiBusinessContext {
  text: string;
  sourceLabels: string[];
  selectedDomains: AiKnowledgeDomain[];
  deniedDomains: AiKnowledgeDomain[];
  capabilities: AiCapabilities;
  errors: string[];
}

function wantsCompleteList(query: string): boolean {
  const normalized = query
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return /\b(tous|toutes|liste complete|integralite|exhaustif)\b/.test(normalized);
}

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[profondeur limitée]';
  if (typeof value === 'string') return value.slice(0, 1_500);
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitize(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !/(token|secret|ciphertext|storage_path|payload_sha256|idempotency_key)/i.test(key))
        .map(([key, item]) => [key, sanitize(item, depth + 1)]),
    );
  }
  return value;
}

function buildAggregate(rows: Array<Record<string, unknown>>, fields: readonly string[]) {
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    const values = rows.map((row) => row[field]).filter((value) => value !== null && value !== undefined);
    if (values.length === 0) continue;

    if (values.every((value) => typeof value === 'number')) {
      const numbers = values as number[];
      result[field] = {
        count: numbers.length,
        min: Math.min(...numbers),
        max: Math.max(...numbers),
        sum: numbers.reduce((sum, value) => sum + value, 0),
        average: numbers.reduce((sum, value) => sum + value, 0) / numbers.length,
      };
      continue;
    }

    if (values.every((value) => typeof value === 'boolean' || typeof value === 'string')) {
      const counts: Record<string, number> = {};
      for (const value of values) {
        const key = String(value);
        counts[key] = (counts[key] ?? 0) + 1;
      }
      if (Object.keys(counts).length <= 50) result[field] = { counts };
    }
  }
  return result;
}

function applyScope(
  query: any,
  spec: SourceSpec,
  params: { organizationId: string; userId: string; planCode: string; industry: string | null },
) {
  if (spec.organizationRelation) {
    return query.eq(`${spec.organizationRelation}.organization_id`, params.organizationId);
  }
  if (spec.scope === 'organization') return query.eq('organization_id', params.organizationId);
  if (spec.scope === 'organization_user') {
    return query.eq('organization_id', params.organizationId).eq('user_id', params.userId);
  }
  if (spec.scope === 'user') return query.eq('user_id', params.userId);
  if (spec.scope === 'profile') return query.eq('id', params.userId);
  if (spec.scope === 'plan') return query.eq(spec.table === 'plans' ? 'code' : 'plan_code', params.planCode);
  if (spec.scope === 'industry' && params.industry) {
    const field = spec.table === 'industries' ? 'code' : 'industry_code';
    return query.eq(field, params.industry);
  }
  return query;
}

async function loadSource(params: {
  admin: SupabaseClient;
  spec: SourceSpec;
  organizationId: string;
  userId: string;
  planCode: string;
  industry: string | null;
  rowLimit: number;
}) {
  const scopeParams = {
    organizationId: params.organizationId,
    userId: params.userId,
    planCode: params.planCode,
    industry: params.industry,
  };
  let query = params.admin.from(params.spec.table).select(params.spec.fields, { count: 'exact' });
  query = applyScope(query, params.spec, scopeParams);
  if (params.spec.order) {
    query = query.order(params.spec.order, { ascending: params.spec.ascending ?? false });
  }
  const { data, error, count } = await query.limit(params.rowLimit);
  if (error) {
    return { table: params.spec.table, error: error.message };
  }

  // `from()` reçoit un nom de table dynamique : supabase-js ne peut pas résoudre
  // le type de ligne et retombe sur `GenericStringError[]`. Le passage par
  // `unknown` est la conversion que TypeScript exige alors — `error` vient
  // d'être écarté ci-dessus, donc `data` porte bien des lignes.
  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
  let aggregate: Record<string, unknown> | undefined;
  let aggregateComplete = true;
  if (params.spec.aggregateFields?.length && (count ?? 0) > rows.length) {
    const aggregateRows: Array<Record<string, unknown>> = [];
    const aggregateSelect = [
      ...params.spec.aggregateFields,
      ...(params.spec.organizationRelationSelect
        ? [params.spec.organizationRelationSelect]
        : []),
    ]
      .filter((value, index, all) => all.indexOf(value) === index)
      .join(',');
    for (let offset = 0; offset < Math.min(count ?? 0, AGGREGATE_HARD_LIMIT); offset += AGGREGATE_PAGE_SIZE) {
      let aggregateQuery = params.admin
        .from(params.spec.table)
        .select(aggregateSelect)
        .range(offset, Math.min(offset + AGGREGATE_PAGE_SIZE - 1, AGGREGATE_HARD_LIMIT - 1));
      aggregateQuery = applyScope(aggregateQuery, params.spec, scopeParams);
      const aggregateResult = await aggregateQuery;
      if (aggregateResult.error) {
        aggregateComplete = false;
        break;
      }
      aggregateRows.push(
        ...((aggregateResult.data ?? []) as unknown as Array<Record<string, unknown>>),
      );
      if ((aggregateResult.data ?? []).length < AGGREGATE_PAGE_SIZE) break;
    }
    aggregateComplete = aggregateComplete && (count ?? 0) <= aggregateRows.length;
    aggregate = buildAggregate(aggregateRows, params.spec.aggregateFields);
  } else if (params.spec.aggregateFields?.length) {
    aggregate = buildAggregate(rows, params.spec.aggregateFields);
  }

  return {
    table: params.spec.table,
    total_count: count ?? rows.length,
    returned_count: rows.length,
    complete_list: (count ?? rows.length) <= rows.length,
    aggregate_complete: aggregateComplete,
    ...(aggregate && Object.keys(aggregate).length > 0 ? { aggregate } : {}),
    rows: sanitize(rows),
  };
}

async function loadCapabilities(params: {
  admin: SupabaseClient;
  organizationId: string;
  role: string;
}): Promise<AiCapabilities> {
  const [{ data: organization }, { data: permissionRows }] = await Promise.all([
    params.admin
      .from('organizations')
      .select('plan_code,industry')
      .eq('id', params.organizationId)
      .maybeSingle(),
    params.admin.from('role_permissions').select('permission').eq('role', params.role),
  ]);
  const planCode = organization?.plan_code ?? 'free';
  const { data: featureRows } = await params.admin
    .from('plan_features')
    .select('feature_key,limit_value')
    .eq('plan_code', planCode);

  return {
    role: params.role,
    planCode,
    industry: organization?.industry ?? null,
    permissions: new Set((permissionRows ?? []).map((row) => row.permission)),
    features: new Set(
      (featureRows ?? [])
        .filter((row) => row.limit_value === null || row.limit_value > 0)
        .map((row) => row.feature_key),
    ),
  };
}

export function canAccessKnowledgeDomain(
  domain: AiKnowledgeDomain,
  capabilities: AiCapabilities,
): boolean {
  if (domain.informationalOnly) return false;
  if (domain.permission && !capabilities.permissions.has(domain.permission)) return false;
  if (domain.feature && !capabilities.features.has(domain.feature)) return false;
  return true;
}

export async function loadAiBusinessContext(params: {
  admin: SupabaseClient;
  organizationId: string;
  userId: string;
  role: string;
  query: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<AiBusinessContext> {
  const capabilities = await loadCapabilities(params);
  const classifierText = [
    ...(params.history ?? []).slice(-4).map((message) => message.content),
    params.query,
  ].join('\n');
  const selectedDomains = selectKnowledgeDomains(classifierText);
  const allowedDomains = selectedDomains.filter((domain) =>
    canAccessKnowledgeDomain(domain, capabilities),
  );
  const deniedDomains = selectedDomains.filter(
    (domain) => !canAccessKnowledgeDomain(domain, capabilities),
  );
  const globalRequest = selectedDomains.length > 8;
  const rowLimit = globalRequest
    ? 5
    : wantsCompleteList(params.query)
      ? COMPLETE_LIST_LIMIT
      : DEFAULT_ROW_LIMIT;
  const errors: string[] = [];
  const sourceLabels = new Set<string>();
  const blocks: string[] = [];

  for (const domain of allowedDomains) {
    const specs = DOMAIN_SOURCES[domain.key] ?? [];
    const results = await Promise.all(
      specs.map((spec) =>
        loadSource({
          admin: params.admin,
          spec,
          organizationId: params.organizationId,
          userId: params.userId,
          planCode: capabilities.planCode,
          industry: capabilities.industry,
          rowLimit,
        }),
      ),
    );
    for (const result of results) {
      if ('error' in result) errors.push(`${result.table}: ${result.error}`);
      else sourceLabels.add(`Table PostgreSQL : ${result.table}`);
    }
    blocks.push(`DOMAINE ${domain.key} — ${domain.label}\n${JSON.stringify(results)}`);
  }

  if (deniedDomains.length > 0) {
    blocks.push(
      `DOMAINES NON AUTORISÉS POUR CE COMPTE — ne donne aucune donnée et explique la limite : ${deniedDomains
        .map((domain) => domain.key)
        .join(', ')}`,
    );
  }
  if (errors.length > 0) {
    blocks.push(
      `SOURCES MOMENTANÉMENT INDISPONIBLES — ne transforme jamais ces erreurs en zéro résultat : ${errors.join('; ')}`,
    );
  }

  return {
    text: blocks.join('\n\n'),
    sourceLabels: [...sourceLabels],
    selectedDomains: allowedDomains,
    deniedDomains,
    capabilities,
    errors,
  };
}
