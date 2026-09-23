import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import CompassTool from './CompassTool';

function dispatchOrientation(
  type: 'deviceorientation' | 'deviceorientationabsolute',
  values: {
    alpha: number;
    absolute: boolean;
    webkitCompassHeading?: number;
    webkitCompassAccuracy?: number;
  },
) {
  const event = new Event(type);
  Object.defineProperties(event, {
    alpha: { value: values.alpha },
    beta: { value: 0 },
    gamma: { value: 0 },
    absolute: { value: values.absolute },
    webkitCompassHeading: { value: values.webkitCompassHeading },
    webkitCompassAccuracy: { value: values.webkitCompassAccuracy },
  });
  window.dispatchEvent(event);
}

describe('CompassTool', () => {
  it('refuse de présenter une orientation relative comme un cap magnétique', async () => {
    render(<CompassTool />);

    act(() => dispatchOrientation('deviceorientation', { alpha: 123, absolute: false }));

    expect(await screen.findByText('Nord magnétique indisponible')).toBeInTheDocument();
    expect(screen.getByText('—°')).toBeInTheDocument();
  });

  it("utilise l'événement absolu Android pour calculer la direction", async () => {
    render(<CompassTool />);

    act(() => dispatchOrientation('deviceorientationabsolute', { alpha: 90, absolute: true }));

    expect(await screen.findByText('270°')).toBeInTheDocument();
    expect(screen.getByText('O • Ouest')).toBeInTheDocument();
  });

  it('demande un calibrage quand iOS déclare son cap inutilisable', async () => {
    render(<CompassTool />);

    act(() =>
      dispatchOrientation('deviceorientation', {
        alpha: 0,
        absolute: false,
        webkitCompassHeading: 0,
        webkitCompassAccuracy: -1,
      }),
    );

    expect(await screen.findByText('Boussole à calibrer')).toBeInTheDocument();
    expect(screen.getByText('—°')).toBeInTheDocument();
  });
});
