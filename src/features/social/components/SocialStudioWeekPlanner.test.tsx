import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SocialPostWithAssets, SocialStudioWeek } from '../weekly-planning';

import { SocialStudioWeekPlanner } from './SocialStudioWeekPlanner';

const {
  useSocialStudioWeek,
  useCreateDevelopmentSocialWeek,
  useGenerateSocialStudioWeek,
  useUpdateSocialPost,
} = vi.hoisted(() => ({
    useSocialStudioWeek: vi.fn(),
    useCreateDevelopmentSocialWeek: vi.fn(),
    useGenerateSocialStudioWeek: vi.fn(),
    useUpdateSocialPost: vi.fn(),
  }));

vi.mock('../hooks/useSocialStudioWeek', () => ({
  useSocialStudioWeek,
  useCreateDevelopmentSocialWeek,
  useGenerateSocialStudioWeek,
  useUpdateSocialPost,
}));

const updateMutate = vi.fn();
const createMutate = vi.fn();
const generateMutate = vi.fn();

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
        height: 1080,
        alt_text: null,
        provider: 'phase-c-mock',
        created_by: null,
        created_at: '2026-09-26T00:00:00.000Z',
      },
    ],
  };
}

function weekFixture(statuses: SocialPostWithAssets['status'][] = Array(7).fill('draft')) {
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
      created_by: null,
      approved_by: null,
      approved_at: null,
      created_at: '2026-09-26T00:00:00.000Z',
      updated_at: '2026-09-26T00:00:00.000Z',
    },
    posts: statuses.map((status, index) => post(index + 1, status)),
  } satisfies SocialStudioWeek;
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
  useUpdateSocialPost.mockReturnValue({
    mutate: updateMutate,
    isPending: false,
    error: null,
  });

  render(
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
});

describe('SocialStudioWeekPlanner', () => {
  it('affiche les 7 jours de la semaine Instagram', () => {
    renderPlanner();

    for (const day of ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI', 'DIMANCHE']) {
      expect(screen.getByText(new RegExp(day))).toBeInTheDocument();
    }
    expect(screen.getByText(/0\/7 prêts · 7 à compléter/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Valider et programmer la semaine' })).toBeDisabled();
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
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('Texte sur le visuel')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Hook'));
    await user.click(screen.getByRole('button', { name: 'Marquer READY' }));

    expect(screen.getByText('Hook requis pour passer en READY')).toBeInTheDocument();
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

    expect(screen.getByLabelText('Date')).toBeDisabled();
    expect(screen.getByLabelText('Heure')).toBeDisabled();
    expect(screen.getByText(/managers peuvent préparer le contenu/i)).toBeInTheDocument();
  });

  it('bloque les actions de modification sans social.manage', () => {
    renderPlanner({ canManage: false });

    expect(screen.getAllByRole('button', { name: 'Modifier' })[0]).toBeDisabled();
  });
});
