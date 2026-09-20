import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.112.2';

/**
 * La page du Workspace à laquelle une conversation est attachée.
 *
 * Le client de service ne passe pas par la RLS : la visibilité est donc
 * REJOUÉE ici, avec la même règle que `app.workspace_space_visible` — une
 * page d'un espace partagé se lit avec `workspace.view` ; une page d'un
 * espace personnel ne se lit que par son propriétaire. Sans ce contrôle, un
 * identifiant deviné suffirait à faire résumer par l'assistant les notes
 * privées d'un collègue.
 */

export interface WorkspacePageContext {
  id: string;
  title: string;
  /** Texte extrait par la base (`workspace_pages.search_text`), tronqué. */
  text: string;
  truncated: boolean;
}

/** Au-delà, la page domine le prompt et le coût ; on coupe et on le dit. */
export const WORKSPACE_PAGE_MAX_CHARS = 24_000;

export async function loadWorkspacePageContext(params: {
  admin: SupabaseClient;
  organizationId: string;
  userId: string;
  role: string;
  pageId: string;
}): Promise<WorkspacePageContext | null> {
  const { admin, organizationId, userId, role, pageId } = params;

  const { data: canView } = await admin
    .from('role_permissions')
    .select('permission')
    .eq('role', role)
    .eq('permission', 'workspace.view')
    .maybeSingle();
  if (!canView) return null;

  const { data: page, error } = await admin
    .from('workspace_pages')
    .select('id, title, search_text, archived_at, space:workspace_spaces(owner_member_id)')
    .eq('id', pageId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error || !page || page.archived_at) return null;

  const space = (Array.isArray(page.space) ? page.space[0] : page.space) as
    { owner_member_id: string | null } | null | undefined;
  if (space?.owner_member_id) {
    const { data: owner } = await admin
      .from('organization_members')
      .select('user_id')
      .eq('id', space.owner_member_id)
      .maybeSingle();
    if (!owner || owner.user_id !== userId) return null;
  }

  const full = (page.search_text as string | null) ?? '';
  const truncated = full.length > WORKSPACE_PAGE_MAX_CHARS;
  return {
    id: page.id as string,
    title: page.title as string,
    text: truncated ? full.slice(0, WORKSPACE_PAGE_MAX_CHARS) : full,
    truncated,
  };
}

/** Le bloc de prompt, balisé comme non fiable. Vide sans page. */
export function workspacePageBlock(page: WorkspacePageContext | null): string {
  if (!page) return '';
  return `<WORKSPACE_PAGE_UNTRUSTED title=${JSON.stringify(page.title)}>
${page.text.trim().length > 0 ? page.text : '(page vide)'}
${page.truncated ? '\n[Page tronquée : seule la première partie est fournie.]' : ''}
</WORKSPACE_PAGE_UNTRUSTED>
`;
}
