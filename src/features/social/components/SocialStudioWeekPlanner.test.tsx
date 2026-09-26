import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SocialPostWithAssets, SocialStudioWeek } from '../weekly-planning';

import { SocialStudioWeekPlanner } from './SocialStudioWeekPlanner';

const {
  useSocialStudioWeek,
  useCreateDevelopmentSocialWeek,
  useCancelSocialPost,
  useGenerateSocialPostImages,
  useGenerateSocialStudioWeek,
  useSelectSocialPostAsset,
  useSetSocialWeekPublishingSuspended,
  useUpdateSocialPost,
  useValidateAndScheduleSocialWeek,
} = vi.hoisted(() => ({
  useSocialStudioWeek: vi.fn(),
  useCreateDevelopmentSocialWeek: vi.fn(),
  useCancelSocialPost: vi.fn(),
  useGenerateSocialPostImages: vi.fn(),
  useGenerateSocialStudioWeek: vi.fn(),
  useSelectSocialPostAsset: vi.fn(),
  useSetSocialWeekPublishingSuspended: vi.fn(),
  useUpdateSocialPost: vi.fn(),
  useValidateAndScheduleSocialWeek: vi.fn(),
}));

vi.mock('../hooks/useSocialStudioWeek', () => ({
  useSocialStudioWeek,
  useCreateDevelopmentSocialWeek,
  useCancelSocialPost,
  useGenerateSocialPostImages,
  useGenerateSocialStudioWeek,
  useSelectSocialPostAsset,
  useSetSocialWeekPublishingSuspended,
  useUpdateSocialPost,
  useValidateAndScheduleSocialWeek,
}));

const updateMutate = vi.fn();
const createMutate = vi.fn();
const generateMutate = vi.fn();
const generateImagesMutate = vi.fn();
const selectAssetMutate = vi.fn();
const validateWeekMutate = vi.fn();
const suspendWeekMutate = vi.fn();
const cancelPostMutate = vi.fn();

function post(slot: number, status: SocialPostWithAssets['status']): SocialPostWithAssets {
  const plannedAt = new Date('2026-09-28T18:30:00');
  plannedAt.setDate(plannedAt.getDate() + slot - 1);
  const iso = plannedAt.toISOString();
  return {
    id: `post-${slot}`,
    organization_id: '00000000-0000-0000-0000-000000000001',
    week_id: 'week-1',
    account_id: null,
    slot_index: slot,
    status,
    format: 'image',
    scheduled_at: null,
    publish_mode: 'dry_run',
    publish_state: 'not_scheduled',
    selected_asset_id: null,
    schedule_timezone: null,
    approved_snapshot: {},
    publish_attempt_id: null,
    publish_attempts: 0,
    publish_locked_at: null,
    publish_lock_token: null,
    publish_next_attempt_at: null,
    publish_last_error_code: null,
    publish_last_error_kind: null,
    publish_reconciliation_required_at: null,
    dry_run_published_at: null,
    hook: `Hook ${slot} terrain`,
    marketing_angle: null,
    concept: null,
    visual_brief: null,
    visual_text: `Message visuel ${slot}`,
    caption: `Legende Instagram complete pour le post ${slot}.`,
    cta: 'Voir REZO360',
    hashtags: [],
    image_prompt: null,
    recommendation_reason: null,
    content: {
      planned_for: iso,
      objective: 'Visites du profil',
      audience: slot === 2 ? 'Artisans' : 'PME',
      placeholder_variant: `slot-${slot}`,
    },
    approved_by: null,
    approved_at: null,
    cancelled_by: null,
    cancelled_at: null,
    published_at: null,
    instagram_media_id: null,
    last_error: null,
    created_by: null,
    created_at: '2026-09-26T00:00:00.000Z',
    updated_at: '2026-09-26T00:00:00.000Z',
    assets: [
      {
        id: `asset-${slot}`,
        organization_id: '00000000-0000-0000-0000-000000000001',
        post_id: `post-${slot}`,
        kind: 'source',
        position: 1,
        storage_path: `org/mock/${slot}.webp`,
        original_filename: null,
        mime_type: 'image/webp',
        size_bytes: null,
        width: 1080,
        height: 1350,
        alt_text: null,
        provider: 'phase-c-mock',
        created_by: null,
        created_at: '2026-09-26T00:00:00.000Z',
        signedUrl: `https://assets.test/${slot}.webp`,
      },
    ],
  };
}

function weekFixture(
  statuses: SocialPostWithAssets['status'][] = Array.from({ length: 7 }, () => 'draft' as const),
): SocialStudioWeek {
  return {
    week: {
      id: 'week-1',
      organization_id: '00000000-0000-0000-0000-000000000001',
      account_id: null,
      starts_on: '2026-09-28',
      status: 'draft',
      objective: 'Prospects artisans',
      audience: 'Artisans',
      zone: 'France + DOM',
      strategy: {},
      timezone: 'Europe/Paris',
      publishing_suspended_at: null,
      publishing_suspended_by: null,
      created_by: null,
      approved_by: null,
      approved_at: null,
      created_at: '2026-09-26T00:00:00.000Z',
      updated_at: '2026-09-26T00:00:00.000Z',
    },
    posts: statuses.map((status, index) => post(index + 1, status)),
  };
}

function sevenStatuses(status: SocialPostWithAssets['status']) {
  return Array.from({ length: 7 }, () => status);
}

function renderPlanner({
  data = weekFixture(),
  canManage = true,
  canPublish = true,
}: {
  data?: SocialStudioWeek | null;
  canManage?: boolean;
  canPublish?: boolean;
} = {}) {
  useSocialStudioWeek.mockReturnValue({
    data,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  });
  useCreateDevelopmentSocialWeek.mockReturnValue({
    mutate: createMutate,
    isPending: false,
  });
  useGenerateSocialStudioWeek.mockReturnValue({
    mutate: generateMutate,
    isPending: false,
    error: null,
  });
  useGenerateSocialPostImages.mockReturnValue({
    mutate: generateImagesMutate,
    isPending: false,
    error: null,
  });
  useSelectSocialPostAsset.mockReturnValue({
    mutate: selectAssetMutate,
    isPending: false,
    error: null,
  });
  useUpdateSocialPost.mockReturnValue({
    mutate: updateMutate,
    isPending: false,
    error: null,
  });
  useValidateAndScheduleSocialWeek.mockReturnValue({
    mutate: validateWeekMutate,
    isPending: false,
    error: null,
  });
  useSetSocialWeekPublishingSuspended.mockReturnValue({
    mutate: suspendWeekMutate,
    isPending: false,
    error: null,
  });
  useCancelSocialPost.mockReturnValue({
    mutate: cancelPostMutate,
    isPending: false,
    error: null,
  });

  return render(
    <SocialStudioWeekPlanner
      organizationId="00000000-0000-0000-0000-000000000001"
      startsOn="2026-09-28"
      canManage={canManage}
      canPublish={canPublish}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('SocialStudioWeekPlanner', () => {
  it('affiche les 7 jours de la semaine Instagram', () => {
    renderPlanner();

    for (const day of ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI', 'DIMANCHE']) {
      expect(screen.getByText(new RegExp(day))).toBeDefined();
    }
    expect(screen.getByText(/0\/7 prêts · 7 à compléter/)).toBeDefined();
    expect(
      screen
        .getByRole('button', {
          name: 'Valider et programmer la semaine',
        })
        .hasAttribute('disabled'),
    ).toBe(true);
  });

  it('lance Social Studio AI uniquement sur action explicite', async () => {
    const user = userEvent.setup();
    renderPlanner({ data: null });

    expect(generateMutate).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Préparer ma semaine' }));
    expect(generateMutate).toHaveBeenCalledTimes(1);
    expect(createMutate).not.toHaveBeenCalled();
  });

  it('conserve un mock de developpement explicite et separé de Social Studio AI', async () => {
    const user = userEvent.setup();
    renderPlanner({ data: null });

    await user.click(screen.getByRole('button', { name: 'Créer des brouillons de test' }));

    expect(createMutate).toHaveBeenCalledTimes(1);
    expect(generateMutate).not.toHaveBeenCalled();
  });

  it('ouvre l’édition et valide les champs avant READY', async () => {
    const user = userEvent.setup();
    renderPlanner();

    await user.click(screen.getAllByRole('button', { name: 'Modifier' })[0]!);
    const dialog = screen.getByRole('dialog', { name: 'Modifier la publication' });
    expect(dialog).toBeDefined();
    expect(within(dialog).getByText('Texte sur le visuel')).toBeDefined();

    await user.clear(screen.getByLabelText('Hook'));
    await user.click(screen.getByRole('button', { name: 'Marquer READY' }));

    expect(screen.getByText('Hook requis pour passer en READY')).toBeDefined();
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it('enregistre un brouillon puis transmet l’intention READY', async () => {
    const user = userEvent.setup();
    renderPlanner();

    await user.click(screen.getAllByRole('button', { name: 'Modifier' })[0]!);
    await user.click(screen.getByRole('button', { name: 'Enregistrer brouillon' }));

    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ intent: 'draft' }),
      expect.any(Object),
    );

    updateMutate.mockClear();
    await user.click(screen.getByRole('button', { name: 'Marquer READY' }));
    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ intent: 'ready' }),
      expect.any(Object),
    );
  });

  it('laisse un manager préparer le contenu sans modifier l’horaire de publication', async () => {
    const user = userEvent.setup();
    renderPlanner({ canManage: true, canPublish: false });

    await user.click(screen.getAllByRole('button', { name: 'Modifier' })[0]!);

    expect(screen.getByLabelText('Date').hasAttribute('disabled')).toBe(true);
    expect(screen.getByLabelText('Heure').hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/managers peuvent préparer le contenu/i)).toBeDefined();
  });

  it('bloque les actions de modification sans social.manage', () => {
    renderPlanner({ canManage: false });

    expect(screen.getAllByRole('button', { name: 'Modifier' })[0]?.hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('declenche la generation visuelle pour un brouillon sans publication', async () => {
    const user = userEvent.setup();
    const week = weekFixture();
    week.posts[0]!.assets = [];
    renderPlanner({ data: week });

    await user.click(screen.getAllByRole('button', { name: 'Générer le visuel' })[0]!);

    expect(generateImagesMutate).toHaveBeenCalledWith(
      { postId: 'post-1', force: false },
      expect.any(Object),
    );
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it('permet de selectionner une variante image generee', async () => {
    const user = userEvent.setup();
    const week = weekFixture();
    week.posts[0]!.assets = [
      {
        ...week.posts[0]!.assets[0]!,
        id: 'asset-generated-1',
        kind: 'generated',
        position: 1,
        signedUrl: 'https://assets.test/generated-1.png',
      },
      {
        ...week.posts[0]!.assets[0]!,
        id: 'asset-generated-2',
        kind: 'generated',
        position: 2,
        signedUrl: 'https://assets.test/generated-2.png',
      },
    ];
    renderPlanner({ data: week });

    await user.click(screen.getByRole('button', { name: /Variante 2/i }));

    expect(selectAssetMutate).toHaveBeenCalledWith({
      postId: 'post-1',
      assetId: 'asset-generated-2',
    });
  });

  it('valide et programme les 7 publications READY en une seule action', async () => {
    const user = userEvent.setup();
    const week = weekFixture(sevenStatuses('ready'));
    week.posts = week.posts.map((item) => ({
      ...item,
      assets: [
        { ...item.assets[0]!, id: `selected-${item.slot_index}`, kind: 'selected' as const },
      ],
    }));
    renderPlanner({ data: week });

    await user.click(screen.getByRole('button', { name: 'Valider et programmer la semaine' }));

    expect(validateWeekMutate).toHaveBeenCalledWith({
      weekId: 'week-1',
      timezone: expect.any(String),
    });
  });

  it('refuse la validation tant que 1 publication manque', () => {
    const week = weekFixture(['ready', 'ready', 'ready', 'ready', 'ready', 'ready', 'draft']);
    week.posts = week.posts.map((item) => ({
      ...item,
      assets: [
        { ...item.assets[0]!, id: `selected-${item.slot_index}`, kind: 'selected' as const },
      ],
    }));

    renderPlanner({ data: week });

    expect(
      screen
        .getByRole('button', {
          name: 'Valider et programmer la semaine',
        })
        .hasAttribute('disabled'),
    ).toBe(true);
    expect(screen.getByText('Chaque publication doit être READY.')).toBeDefined();
  });

  it('permet de suspendre puis reprendre une semaine programmée', async () => {
    const user = userEvent.setup();
    const week = weekFixture(sevenStatuses('scheduled'));
    week.week.status = 'scheduled';
    week.posts = week.posts.map((item) => ({
      ...item,
      publish_state: 'scheduled',
      scheduled_at:
        item.content && typeof item.content === 'object' && !Array.isArray(item.content)
          ? String((item.content as { planned_for?: string }).planned_for)
          : null,
    }));
    const view = renderPlanner({ data: week });

    await user.click(screen.getByRole('button', { name: 'Suspendre les publications' }));
    expect(suspendWeekMutate).toHaveBeenCalledWith({ weekId: 'week-1', suspended: true });

    suspendWeekMutate.mockClear();
    week.week.publishing_suspended_at = '2026-09-28T18:00:00.000Z';
    view.unmount();
    renderPlanner({ data: week });
    await user.click(screen.getByRole('button', { name: 'Reprendre les publications' }));
    expect(suspendWeekMutate).toHaveBeenCalledWith({ weekId: 'week-1', suspended: false });
  });

  it('annule une publication programmée avant traitement', async () => {
    const user = userEvent.setup();
    const week = weekFixture(sevenStatuses('scheduled'));
    week.week.status = 'scheduled';
    week.posts = week.posts.map((item) => ({
      ...item,
      publish_state: 'scheduled',
      scheduled_at:
        item.content && typeof item.content === 'object' && !Array.isArray(item.content)
          ? String((item.content as { planned_for?: string }).planned_for)
          : null,
    }));
    renderPlanner({ data: week });

    await user.click(screen.getAllByRole('button', { name: 'Annuler cette publication' })[0]!);

    expect(cancelPostMutate).toHaveBeenCalledWith({ postId: 'post-1' });
  });
});
