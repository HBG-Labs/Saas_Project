import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderBootFailure } from './boot-failure';

describe('écran de secours au démarrage', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    vi.restoreAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('propose de réessayer sans exposer le détail d’une erreur inconnue', () => {
    const container = document.getElementById('root');

    renderBootFailure(container, new Error('nom_table_interne: contrainte secrète'));

    expect(document.querySelector('h1')).toHaveTextContent('L’application n’a pas pu démarrer');
    expect(document.querySelector('button')).toHaveTextContent('Réessayer');
    expect(document.body).not.toHaveTextContent('nom_table_interne');
  });

  it('conserve l’explication utile lorsqu’une variable de déploiement manque', () => {
    renderBootFailure(
      document.getElementById('root'),
      new Error("Configuration d'environnement invalide : VITE_SUPABASE_URL manque"),
    );

    expect(document.body).toHaveTextContent('Sa configuration est incomplète');
    expect(document.querySelector('pre')).toHaveTextContent('VITE_SUPABASE_URL manque');
    expect(document.querySelector('button')).toHaveTextContent('Réessayer');
  });
});
