import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ClosingScene } from './ClosingScene';
import { FieldFilm } from './FieldFilm';

afterEach(() => vi.unstubAllGlobals());

describe('Landing films — progressive enhancement', () => {
  it('keeps both posters without loading video when reduced motion is preferred', () => {
    const observe = vi.fn();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe = observe;
        disconnect = vi.fn();
      },
    );
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    const { container } = render(
      <>
        <FieldFilm />
        <ClosingScene />
      </>,
    );
    expect(screen.getAllByRole('img')).toHaveLength(2);
    expect(container.querySelector('video')).toBeNull();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    expect(observe).not.toHaveBeenCalled();
  });

  it('keeps a complete static fallback without IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const { container } = render(
      <>
        <FieldFilm />
        <ClosingScene />
      </>,
    );
    expect(screen.getByRole('heading', { name: 'Le bon dossier. Sur le terrain.' })).toBeVisible();
    expect(screen.getAllByRole('img')).toHaveLength(2);
    expect(container.querySelector('video')).toBeNull();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    expect(container.querySelector('.lp-closing-travel')).toBeNull();
  });
});
