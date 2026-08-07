import { z } from 'zod';

/** Validation des entrées saisies par l'utilisateur, avant appel à `compute`. */
export const exampleInputSchema = z.object({
  value: z.number().finite(),
  factor: z.number().finite(),
});

export type ExampleInputSchema = z.infer<typeof exampleInputSchema>;
