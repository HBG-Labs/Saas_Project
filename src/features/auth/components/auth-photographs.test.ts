import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AUTH_PHOTOGRAPHS, selectAuthPhotograph, useAuthPhotograph } from './auth-photographs';

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('auth photographs', () => {
  it('can select each of the five photographs on a first visit', () => {
    const chosen = AUTH_PHOTOGRAPHS.map(
      (_, index) => selectAuthPhotograph(null, () => (index + 0.5) / AUTH_PHOTOGRAPHS.length).id,
    );
    expect(chosen).toEqual(AUTH_PHOTOGRAPHS.map((photo) => photo.id));
  });

  it.each(AUTH_PHOTOGRAPHS)('never repeats $id on the following visit', (previous) => {
    for (const random of [0, 0.25, 0.5, 0.75, 0.999]) {
      expect(selectAuthPhotograph(previous.id, () => random).id).not.toBe(previous.id);
    }
  });

  it('keeps the photo while the form rerenders, then rotates on a new visit', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const firstVisit = renderHook(useAuthPhotograph);
    const firstId = firstVisit.result.current.id;
    firstVisit.rerender();
    expect(firstVisit.result.current.id).toBe(firstId);
    expect(sessionStorage.getItem('rezo360:auth:last-photograph')).toBe(firstId);
    firstVisit.unmount();

    const nextVisit = renderHook(useAuthPhotograph);
    expect(nextVisit.result.current.id).not.toBe(firstId);
  });

  it('still rotates if browser storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const firstVisit = renderHook(useAuthPhotograph);
    const firstId = firstVisit.result.current.id;
    firstVisit.unmount();
    expect(renderHook(useAuthPhotograph).result.current.id).not.toBe(firstId);
  });
});
