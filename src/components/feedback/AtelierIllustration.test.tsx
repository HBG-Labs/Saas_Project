import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AtelierIllustration } from './AtelierIllustration';

describe('AtelierIllustration — Plan vivant', () => {
  it.each(['missions', 'pages', 'quotes', 'teams'] as const)(
    'habille %s avec le plan animé partagé',
    (subject) => {
      const { container } = render(<AtelierIllustration subject={subject} />);
      const illustration = container.querySelector(`[data-atelier-illustration="${subject}"]`);

      expect(illustration).toHaveAttribute('aria-hidden', 'true');
      expect(illustration?.querySelector('[data-atelier-orbit="true"]')).toHaveClass(
        'atelier-illustration-plan',
      );
      expect(illustration?.querySelector('img')).toHaveAttribute('alt', '');
    },
  );
});
