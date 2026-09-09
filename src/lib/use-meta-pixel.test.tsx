import { act, fireEvent, render } from '@testing-library/react';
import { StrictMode, useState } from 'react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { acceptAllCookies } from '@/lib/cookie-consent';

const faux = vi.hoisted(() => ({ pixelId: undefined as string | undefined }));

vi.mock('@/config/env', () => ({
  env: {
    get VITE_META_PIXEL_ID() {
      return faux.pixelId;
    },
  },
}));

const { __resetMetaPixelPourTests } = await import('@/lib/meta-pixel');
const { useMetaPixel } = await import('@/lib/use-meta-pixel');

const ID = '123456789012345';

function pageViews(): number {
  const fbq = (window as { fbq?: { queue: unknown[][] } }).fbq;
  return (fbq?.queue ?? []).filter((a) => a[0] === 'track' && a[1] === 'PageView').length;
}

/** Écran minimal portant le hook, avec un bouton pour changer de route. */
function Ecran({ vers }: { vers: string }) {
  useMetaPixel();
  const naviguer = useNavigate();
  return (
    <button type="button" onClick={() => naviguer(vers)}>
      aller
    </button>
  );
}

function Application() {
  return (
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Ecran vers="/pricing" />} />
        <Route path="/pricing" element={<Ecran vers="/" />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  __resetMetaPixelPourTests();
  faux.pixelId = ID;
});

afterEach(() => {
  __resetMetaPixelPourTests();
  localStorage.clear();
});

describe('useMetaPixel', () => {
  it('compte une seule vue pour la page d’arrivée', () => {
    acceptAllCookies();
    render(<Application />);
    expect(pageViews()).toBe(1);
  });

  it('ne compte qu’une vue sous StrictMode, qui exécute les effets deux fois', () => {
    /*
      LE DÉFAUT QUE CE TEST EXISTE POUR EMPÊCHER.

      `src/main.tsx` monte l'application dans `<StrictMode>`. En développement,
      React y exécute délibérément chaque effet DEUX FOIS — montage, nettoyage,
      remontage — pour débusquer les effets non idempotents.

      Un `fbq('track', 'PageView')` posé nu dans un effet compte alors deux vues
      pour un seul visiteur. Le taux de conversion affiché tombe de moitié, sans
      qu'aucune erreur ne le signale : le chiffre reste plausible, simplement
      faux.

      Le repère de chemin de `useMetaPixel` neutralise ce doublon parce que
      React CONSERVE l'instance du composant — et donc ses `useRef` — entre les
      deux exécutions. C'est bien ce mécanisme-là qu'on éprouve ici, et non un
      remontage complet de l'arbre, qui n'arrive jamais à `RootLayout` en
      conditions réelles.
    */
    acceptAllCookies();
    render(
      <StrictMode>
        <Application />
      </StrictMode>,
    );

    expect(pageViews()).toBe(1);
  });

  it('compte une nouvelle vue à chaque changement de route', () => {
    acceptAllCookies();
    const { getByText } = render(<Application />);
    expect(pageViews()).toBe(1);

    fireEvent.click(getByText('aller'));
    expect(pageViews()).toBe(2);

    // Retour sur `/` : c'est bien une nouvelle vue, le repère ne doit pas
    // l'étouffer. Il n'interdit que deux comptages consécutifs du même chemin.
    fireEvent.click(getByText('aller'));
    expect(pageViews()).toBe(3);
  });

  it('rattrape la vue de la page d’arrivée quand la bannière est acceptée après coup', () => {
    /*
      Le scénario le plus fréquent en trafic publicitaire : le visiteur arrive,
      la bannière s'affiche par-dessus, il accepte.

      Entre l'arrivée et le clic, le pixel était inactif et la vue a été
      ABANDONNÉE — pas mise en file d'attente. Sans rattrapage, toute personne
      acceptant la bannière manquerait à l'appel exactement sur la page que la
      publicité a payée.
    */
    render(<Application />);
    expect(pageViews()).toBe(0);

    // `acceptAllCookies` notifie les abonnes, donc declenche un `setState`
    // dans le hook : sans `act`, React avertit et la vue n'est pas recalculee.
    act(() => {
      acceptAllCookies();
    });

    expect(pageViews()).toBe(1);
  });

  it('ne compte rien sans identifiant configuré', () => {
    faux.pixelId = undefined;
    acceptAllCookies();
    render(<Application />);

    expect(window.fbq).toBeUndefined();
    expect(pageViews()).toBe(0);
  });
});

/** Le hook ne doit pas gêner un écran qui se re-rend pour ses propres raisons. */
describe('useMetaPixel — indifférence aux re-rendus', () => {
  it('ne compte pas de vue supplémentaire quand l’écran se re-rend', () => {
    acceptAllCookies();

    function EcranAvecEtat() {
      useMetaPixel();
      const [n, setN] = useState(0);
      return (
        <button type="button" onClick={() => setN(n + 1)}>
          {`compteur ${String(n)}`}
        </button>
      );
    }

    const { getByRole } = render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<EcranAvecEtat />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(pageViews()).toBe(1);
    fireEvent.click(getByRole('button'));
    fireEvent.click(getByRole('button'));
    expect(pageViews()).toBe(1);
  });
});
