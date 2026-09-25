/** Fictional data for captures of the real application; never sent to a backend. */
import type { Page } from '@playwright/test';
import {
  CLIENT_ID,
  DEVIS_ID,
  FACTURE_ID,
  INTERVENTION_ID,
  MEMBRE_ID,
  MISSION_ID,
  ORGANISATION_ID,
  UTILISATEUR_ID,
  devis,
  devisTotaux,
  donneesPour,
  facture,
  factureTotaux,
} from './donnees';
import { installeSupabase, type OptionsSupabase } from './supabase';
import { PAGE_ID, espace, pageDocument } from '../parcours/workspace-atelier-support';

export { CLIENT_ID, DEVIS_ID, FACTURE_ID, INTERVENTION_ID, MISSION_ID, PAGE_ID };
const DATE = '2026-09-23T08:00:00.000Z';
const id = (group: number, index: number) =>
  `${String(group).padStart(8, '0')}-0000-4000-8000-${String(index).padStart(12, '0')}`;
const paragraph = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const heading = (text: string) => ({
  type: 'heading',
  attrs: { level: 2 },
  content: [{ type: 'text', text }],
});

export async function installMarketingDemo(page: Page, { paid = false } = {}) {
  const base = donneesPour('owner');
  const names = [
    'Atelier Horizon',
    'Résidence Les Alizés',
    'Bureaux Bellevue',
    'Centre Les Jardins',
    'Maison Rivage',
  ];
  const customers = names.map((name, i) => ({
    ...base.customers[0],
    id: i === 0 ? CLIENT_ID : id(44, i),
    name,
    legal_name: name,
    reference: `CLI-${String(i + 1).padStart(4, '0')}`,
    email: `contact${i + 1}@example.test`,
    city: 'Lyon',
    postal_code: '69003',
  }));
  const members = [
    'Camille Martin',
    'Sarah Mercier',
    'Luc Damas',
    'Karim Toussaint',
    'Aline Rosier',
    'Thomas Laurent',
  ].map((display_name, i) => ({
    ...base.organization_members[0],
    id: i === 0 ? MEMBRE_ID : id(77, i),
    user_id: i === 0 ? UTILISATEUR_ID : id(22, i),
    role: i === 0 ? 'owner' : 'technician',
    display_name,
    email: `equipe${i + 1}@example.test`,
    profile: { display_name, avatar_id: null },
  }));
  const teams = ['Maintenance', 'Installation', 'Contrôle'].map((name, i) => ({
    id: id(88, i),
    organization_id: ORGANISATION_ID,
    name,
    description: 'Équipe terrain',
    leader_member_id: members[i + 1]!.id,
    status: 'active',
    created_at: DATE,
    updated_at: DATE,
  }));
  const jobs = [
    'Maintenance préventive CVC',
    'Contrôle des équipements',
    'Installation réseau bâtiment B',
    'Visite technique annuelle',
    'Mise en service ventilation',
    'Diagnostic tableau électrique',
    'Relevés et contrôle qualité',
    'Maintenance centrale de traitement',
    'Vérification des accès',
    'Inspection chaufferie',
    'Installation des capteurs',
    'Contrôle de fin de chantier',
  ];
  const missions = jobs.map((title, i) => {
    const customer = customers[i % customers.length]!;
    return {
      ...base.missions[0],
      id: i === 0 ? MISSION_ID : id(55, i),
      reference: `MIS-${String(142 + i).padStart(4, '0')}`,
      title,
      description: 'Visite de contrôle, relevés et maintenance des installations techniques.',
      customer_id: customer.id,
      customer_name: customer.name,
      customer: { id: customer.id, reference: customer.reference, name: customer.name },
      status: ['in_progress', 'assigned', 'accepted', 'submitted', 'approved', 'completed'][i % 6],
      priority: i % 4 === 0 ? 'high' : 'normal',
      assigned_user_id: members[(i % 5) + 1]!.id,
      assigned_member: members[(i % 5) + 1],
      assigned_team_id: teams[i % 3]!.id,
      assigned_team: teams[i % 3],
      city: 'Lyon',
      postal_code: '69003',
      location_label: customer.name,
      scheduled_start: `2026-09-${String(21 + (i % 5)).padStart(2, '0')}T${i < 5 ? '07' : i < 10 ? '10' : '13'}:00:00.000Z`,
      scheduled_end: `2026-09-${String(21 + (i % 5)).padStart(2, '0')}T${i < 5 ? '09' : i < 10 ? '12' : '15'}:00:00.000Z`,
    };
  });
  const report = {
    id: id(99, 1),
    organization_id: ORGANISATION_ID,
    intervention_id: INTERVENTION_ID,
    technician_id: MEMBRE_ID,
    work_description:
      'Contrôle de la centrale de traitement d’air. Nettoyage des filtres et vérification des connexions électriques. Les mesures sont conformes aux valeurs attendues.',
    observations:
      'Remplacement des filtres à prévoir lors de la prochaine visite. Installation remise en service et contrôlée avec le responsable du site.',
    materials_used: null,
    tools_used: null,
    customer_signature_path: null,
    customer_signature_name: 'Responsable du site',
    technician_signature_path: null,
    status: 'submitted',
    submitted_at: DATE,
    reviewed_at: null,
    reviewed_by: null,
    rejection_reason: null,
    created_at: DATE,
    updated_at: DATE,
    intervention: { id: INTERVENTION_ID, mission: missions[0], technician: members[0] },
  };
  const lines = [
    'Visite technique et diagnostic',
    'Maintenance préventive des équipements',
    'Contrôle et remise en service',
  ].map((description, i) => ({
    id: id(66, i + 10),
    description,
    position: i,
    quantity: [1, 2, 1][i],
    unit: 'forfait',
    unit_price_cents: [48000, 120000, 72000][i],
    vat_rate: 20,
    vat_category: 'S',
    discount_percent: 0,
    quote_id: DEVIS_ID,
    invoice_id: FACTURE_ID,
    organization_id: ORGANISATION_ID,
  }));
  const quotes = jobs.slice(0, 5).map((title, i) =>
    devis({
      id: i === 0 ? DEVIS_ID : id(11, i),
      reference: `DV-2026-${String(87 + i).padStart(4, '0')}`,
      title,
      customer_name: customers[i]!.name,
      customer_id: customers[i]!.id,
      status: ['accepted', 'sent', 'draft', 'accepted', 'sent'][i],
      items: lines,
      vat_rate: 20,
      issue_date: '2026-09-21',
    }),
  );
  const invoices = jobs.slice(0, 5).map((title, i) =>
    facture({
      id: i === 0 ? FACTURE_ID : id(12, i),
      reference: `FA-2026-${String(118 + i).padStart(4, '0')}`,
      title,
      customer_name: customers[i]!.name,
      customer_legal_name: customers[i]!.name,
      customer_id: customers[i]!.id,
      status: i === 0 && paid ? 'paid' : ['issued', 'paid', 'issued', 'draft', 'paid'][i],
      items: lines,
      seller_name: 'Atelier Démonstration',
      seller_legal_name: 'Atelier Démonstration',
      seller_share_capital_cents: 100000,
      early_payment_terms: 'Aucun escompte pour paiement anticipé.',
      late_payment_terms: 'Conditions de règlement convenues au devis.',
      issued_at: '2026-09-22T09:00:00.000Z',
      payment_method: 'Virement bancaire',
      quote_id: i === 0 ? DEVIS_ID : null,
    }),
  );
  const workspace = {
    ...pageDocument,
    title: 'Intervention — Atelier Horizon',
    content: {
      type: 'doc',
      content: [
        paragraph('Toutes les informations utiles à l’équipe, de la préparation au compte rendu.'),
        heading('Préparer la visite'),
        paragraph(
          'Rendez-vous mercredi à 9 h avec le responsable du site. Accès par l’entrée technique, bâtiment B.',
        ),
        heading('Points de contrôle'),
        {
          type: 'bulletList',
          content: [
            'Vérifier les raccordements et les protections.',
            'Nettoyer les filtres et relever les mesures.',
            'Photographier les installations avant remise en service.',
          ].map((text) => ({ type: 'listItem', content: [paragraph(text)] })),
        },
        heading('Compte rendu de visite'),
        paragraph(
          'La maintenance est terminée. Les équipements ont été remis en service après les essais. Le rapport et les photos sont disponibles dans le dossier client.',
        ),
      ],
    },
  };
  const pages = [
    workspace,
    { ...pageDocument, id: id(20, 2), title: 'Procédures et sécurité' },
    { ...pageDocument, id: id(20, 3), title: 'Bibliothèque technique' },
    { ...pageDocument, id: id(20, 4), title: 'Réunion de préparation' },
  ];
  const documents = [
    'Plan des installations — Atelier Horizon',
    'Procédure de contrôle technique',
    'Fiche de préparation intervention',
    'Notice de maintenance CVC',
    'Consignes de sécurité',
    'Dossier de réception',
  ].map((name, i) => ({
    id: id(30, i),
    organization_id: ORGANISATION_ID,
    folder_id: null,
    uploaded_by: UTILISATEUR_ID,
    name,
    original_filename: name + '.pdf',
    storage_path: `${ORGANISATION_ID}/demo-${i}.pdf`,
    mime_type: 'application/pdf',
    file_size: 204800 * (i + 1),
    description: 'Document de référence pour les équipes terrain.',
    category: null,
    shared_with_client: false,
    created_at: DATE,
    updated_at: DATE,
  }));
  await installeSupabase(page, {
    role: 'owner',
    donnees: {
      ...base,
      profiles: [{ ...base.profiles[0], display_name: 'Camille Martin' }],
      organizations: [
        {
          ...base.organizations[0],
          name: 'Atelier Démonstration',
          legal_name: 'Atelier Démonstration',
          industry: null,
        },
      ],
      customers,
      organization_members: members,
      teams,
      missions,
      interventions: [{ ...base.interventions[0], status: 'completed', end_time: DATE, report }],
      intervention_reports: [report],
      quotes,
      quote_totals: quotes.map((q, i) =>
        devisTotaux({
          quote_id: q.id,
          subtotal_cents: 360000 + i * 21000,
          vat_cents: 72000 + i * 4200,
          total_cents: 432000 + i * 25200,
        }),
      ),
      invoices,
      invoice_totals: invoices.map((invoice, i) =>
        factureTotaux({
          invoice_id: invoice.id,
          subtotal_cents: 360000 + i * 21000,
          vat_cents: 72000 + i * 4200,
          total_cents: 432000 + i * 25200,
        }),
      ),
      invoice_vat_breakdown: [
        { invoice_id: FACTURE_ID, vat_rate: 20, base_cents: 360000, vat_cents: 72000 },
      ],
      workspace_spaces: [espace],
      workspace_pages: pages,
      workspace_templates: [],
      workspace_recordings: [],
      workspace_page_visits: [],
      workspace_favorites: [],
      document_folders: ['Plans et dossiers', 'Procédures', 'Notices techniques'].map(
        (name, i) => ({
          id: id(31, i),
          organization_id: ORGANISATION_ID,
          parent_folder_id: null,
          name,
          created_by: UTILISATEUR_ID,
          created_at: DATE,
          updated_at: DATE,
        }),
      ),
      organization_documents: documents,
      audit_logs: [
        'Compte rendu validé',
        'Intervention affectée à l’équipe',
        'Nouveau client enregistré',
        'Intervention terminée',
      ].map((action, i) => ({
        id: id(40, i),
        organization_id: ORGANISATION_ID,
        user_id: members[i]!.user_id,
        actor_name: members[i]!.display_name,
        action,
        entity_type: 'mission',
        entity_id: missions[i]!.id,
        metadata: { title: missions[i]!.title },
        created_at: `2026-09-23T0${9 - i}:15:00.000Z`,
      })),
    } as unknown as OptionsSupabase['donnees'],
    rpc: {
      ensure_personal_workspace_space: espace,
      touch_workspace_page: null,
      transcription_quota_status: [
        { used_minutes: 12, limit_minutes: 120, remaining_minutes: 108, unlimited: false },
      ],
      organization_billing_summary: null,
      get_creditable_invoice_lines: [],
      intervention_worked_seconds: 2880,
    },
  });
  await page.addInitScript(() => {
    localStorage.setItem('rezo360-theme-preset', 'default');
    localStorage.setItem('rezo360-theme', 'light');
  });
}
