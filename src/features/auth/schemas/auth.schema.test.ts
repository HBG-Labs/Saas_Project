import { describe, expect, it } from 'vitest';

import { forgotPasswordSchema, loginSchema, registerSchema } from './auth.schema';

/**
 * La validation se teste sans monter le moindre formulaire : c'est tout
 * l'intérêt d'avoir séparé les schémas des composants.
 */
describe('loginSchema', () => {
  it('normalise l’adresse e-mail', () => {
    const result = loginSchema.parse({ email: '  Jean@Exemple.FR ', password: 'secret' });
    expect(result.email).toBe('jean@exemple.fr');
  });

  it('rejette une adresse invalide', () => {
    expect(loginSchema.safeParse({ email: 'pas-une-adresse', password: 'x' }).success).toBe(false);
  });
});

describe('registerSchema', () => {
  const valid = {
    displayName: 'Jean Dupont',
    email: 'jean@exemple.fr',
    password: 'motdepasselong',
    confirmPassword: 'motdepasselong',
  };

  it('accepte une inscription valide', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it('exige 8 caractères minimum', () => {
    const result = registerSchema.safeParse({
      ...valid,
      password: 'court',
      confirmPassword: 'court',
    });
    expect(result.success).toBe(false);
  });

  it('rattache l’erreur de confirmation au bon champ', () => {
    const result = registerSchema.safeParse({ ...valid, confirmPassword: 'different' });

    expect(result.success).toBe(false);
    if (!result.success) {
      // L'erreur doit viser `confirmPassword` : c'est ce champ que
      // l'utilisateur doit corriger. Attachée à la racine, elle serait invisible.
      expect(result.error.issues.some((issue) => issue.path[0] === 'confirmPassword')).toBe(true);
    }
  });

  it('rejette un nom trop court', () => {
    expect(registerSchema.safeParse({ ...valid, displayName: 'J' }).success).toBe(false);
  });
});

describe('forgotPasswordSchema', () => {
  it('n’exige que l’adresse e-mail', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'jean@exemple.fr' }).success).toBe(true);
  });
});
