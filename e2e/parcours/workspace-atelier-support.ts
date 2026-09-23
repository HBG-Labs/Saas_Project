import type { Page } from '@playwright/test';

import {
  donneesPour,
  MEMBRE_ID,
  ORGANISATION_ID,
  PROFILS,
  UTILISATEUR_ID,
  type RoleTest,
} from '../fixtures/donnees';
import { installeSupabase } from '../fixtures/supabase';

export const ESPACE_ID = 'a1000000-0000-4000-8000-000000000001';
export const PAGE_ID = 'a2000000-0000-4000-8000-000000000001';
export const MODELE_ID = 'a3000000-0000-4000-8000-000000000001';
export const NOTE_ID = 'a4000000-0000-4000-8000-000000000001';
export const DATE = '2026-09-20T08:00:00.000Z';
export const espace = {
  id: ESPACE_ID,
  organization_id: ORGANISATION_ID,
  name: 'Mon espace',
  description: null,
  icon: null,
  position: 0,
  created_by: UTILISATEUR_ID,
  owner_member_id: MEMBRE_ID,
  archived_at: null,
  created_at: DATE,
  updated_at: DATE,
};
export const pageDocument = {
  id: PAGE_ID,
  organization_id: ORGANISATION_ID,
  space_id: ESPACE_ID,
  parent_page_id: null,
  title: 'Préparation du chantier Les Alizés',
  content: {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Prévoir les mesures et prévenir le gardien.' }],
      },
    ],
  },
  search_text: 'Prévoir les mesures et prévenir le gardien.',
  position: 0,
  created_by: UTILISATEUR_ID,
  updated_by: UTILISATEUR_ID,
  archived_at: null,
  icon: null,
  cover_path: null,
  font_family: 'sans',
  small_text: false,
  text_spacing: 'normal',
  full_width: false,
  locked: false,
  accent_color: 'blue',
  wiki_mode: false,
  created_at: DATE,
  updated_at: DATE,
};
export const modele = {
  id: MODELE_ID,
  organization_id: ORGANISATION_ID,
  name: 'Compte rendu de réunion',
  description: null,
  icon: null,
  category: 'equipe',
  content: pageDocument.content,
  position: 0,
  created_by: UTILISATEUR_ID,
  created_at: DATE,
  updated_at: DATE,
};

/** Données uniquement destinées aux vues : aucun appel n'atteint une base réelle. */
export async function installeWorkspace(
  page: Page,
  { role = 'owner', empty = false }: { role?: RoleTest; empty?: boolean } = {},
) {
  const profile = PROFILS[role];
  const pages = empty
    ? []
    : [
        pageDocument,
        {
          ...pageDocument,
          id: 'a2000000-0000-4000-8000-000000000002',
          title: 'Relevés et points de contrôle',
          parent_page_id: PAGE_ID,
          position: 1,
        },
        {
          ...pageDocument,
          id: 'a2000000-0000-4000-8000-000000000003',
          title: 'Consignes de sécurité',
          position: 2,
        },
        {
          ...pageDocument,
          id: 'a2000000-0000-4000-8000-000000000004',
          title: 'Ancienne procédure',
          position: 3,
          archived_at: '2026-09-21T12:00:00.000Z',
        },
      ];
  const donnees = {
    ...donneesPour(role),
    workspace_spaces: [espace],
    workspace_pages: pages,
    workspace_page_visits: empty
      ? []
      : [
          {
            page_id: PAGE_ID,
            user_id: profile.id,
            organization_id: ORGANISATION_ID,
            visited_at: DATE,
            page: pageDocument,
          },
        ],
    workspace_favorites: empty
      ? []
      : [
          {
            page_id: PAGE_ID,
            user_id: profile.id,
            organization_id: ORGANISATION_ID,
            position: 0,
            created_at: DATE,
          },
        ],
    workspace_templates: [modele],
    workspace_recordings: [],
    notes: empty
      ? []
      : [
          {
            id: NOTE_ID,
            user_id: profile.id,
            organization_id: ORGANISATION_ID,
            title: 'Réunion de préparation',
            content:
              'Points à vérifier avant le départ :\n\nPrévenir le gardien et emporter le plan de raccordement.\n\nPenser aux mesures de fin d’intervention.',
            category: 'technique',
            is_pinned: true,
            created_at: DATE,
            updated_at: DATE,
          },
          {
            id: 'a4000000-0000-4000-8000-000000000002',
            user_id: profile.id,
            organization_id: ORGANISATION_ID,
            title: 'Appeler le fournisseur',
            content: 'Confirmer la disponibilité des connecteurs.',
            category: 'memo',
            is_pinned: false,
            created_at: DATE,
            updated_at: DATE,
          },
        ],
    document_folders: empty
      ? []
      : [
          {
            id: 'a5000000-0000-4000-8000-000000000001',
            organization_id: ORGANISATION_ID,
            parent_folder_id: null,
            name: 'Plans et dossiers techniques',
            created_by: profile.id,
            created_at: DATE,
            updated_at: DATE,
          },
          {
            id: 'a5000000-0000-4000-8000-000000000002',
            organization_id: ORGANISATION_ID,
            parent_folder_id: null,
            name: 'Procédures et sécurité',
            created_by: profile.id,
            created_at: DATE,
            updated_at: DATE,
          },
        ],
    organization_documents: empty
      ? []
      : [
          'Plan de raccordement Les Alizés',
          'Procédure de contrôle optique',
          'Fiche de préparation chantier',
          'Répertoire des contacts',
        ].map((name, i) => ({
          id: 'a6000000-0000-4000-8000-' + String(i + 1).padStart(12, '0'),
          organization_id: ORGANISATION_ID,
          folder_id: null,
          uploaded_by: profile.id,
          name,
          original_filename: name + '.pdf',
          storage_path: ORGANISATION_ID + '/document-' + String(i) + '.pdf',
          mime_type: 'application/pdf',
          file_size: 204800 * (i + 1),
          description: 'Document de référence pour les équipes terrain.',
          category: null,
          shared_with_client: false,
          created_at: DATE,
          updated_at: DATE,
        })),
  };
  return installeSupabase(page, {
    role,
    donnees,
    rpc: {
      ensure_personal_workspace_space: espace,
      transcription_quota_status: [
        {
          used_minutes: 12,
          limit_minutes: 120,
          remaining_minutes: 108,
          unlimited: false,
        },
      ],
      touch_workspace_page: null,
      search_workspace_pages: empty
        ? []
        : [
            {
              id: PAGE_ID,
              title: pageDocument.title,
              icon: null,
              snippet: 'Prévoir les mesures et prévenir le gardien.',
              space_id: ESPACE_ID,
              updated_at: DATE,
            },
          ],
      create_page_from_template: pageDocument,
      save_workspace_page: { ...pageDocument, updated_at: '2026-09-20T09:00:00.000Z' },
    },
  });
}
