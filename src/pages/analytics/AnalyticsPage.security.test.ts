import { describe, expect, it } from 'vitest';

import { escapeAnalyticsHtml } from './analytics-export';

describe('escapeAnalyticsHtml', () => {
  it('neutralise les balises et attributs injectés dans le rapport imprimable', () => {
    expect(escapeAnalyticsHtml('<img src=x onerror="alert(1)">')).toBe(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;',
    );
  });

  it('échappe aussi les apostrophes et esperluettes', () => {
    expect(escapeAnalyticsHtml("L'atelier & associés")).toBe('L&#39;atelier &amp; associés');
  });
});
