import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { ROUTES } from '@/config/routes';

import { ToolCard } from './ToolCard';

const tool = {
  slug: 'scientific-calculator',
  title: 'Calculatrice scientifique',
  description: 'Calculs scientifiques avancés',
  category: 'universal',
  icon: 'calculator',
};

const renderCard = (variant: 'grid' | 'list', onToggleFavorite = vi.fn()) =>
  render(
    <MemoryRouter>
      <ToolCard
        tool={tool}
        variant={variant}
        isFavorite={false}
        onToggleFavorite={onToggleFavorite}
      />
    </MemoryRouter>,
  );

describe('ToolCard', () => {
  it('rend une ligne entièrement ouvrable sans bouton Lancer', () => {
    const toggleFavorite = vi.fn();
    renderCard('list', toggleFavorite);

    const link = screen.getByRole('link', { name: tool.title });
    expect(link).toHaveAttribute('href', ROUTES.tool(tool.slug));
    expect(screen.queryByText('Lancer')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: `Ajouter ${tool.title} aux favoris` }));
    expect(toggleFavorite).toHaveBeenCalledWith(tool.slug);
  });

  it('supprime aussi l’action Lancer de la variante en grille', () => {
    renderCard('grid');

    expect(screen.queryByText('Lancer')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: tool.title })).toHaveAttribute(
      'href',
      ROUTES.tool(tool.slug),
    );
  });
});
