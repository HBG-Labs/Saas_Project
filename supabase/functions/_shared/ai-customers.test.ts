import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';

import {
  answerFirstCustomerQuestion,
  sortCustomersByCreation,
  type AiCustomer,
} from './ai-customers.ts';

const customers: AiCustomer[] = [
  {
    id: '00000000-0000-4000-8000-000000000002',
    name: 'Mairie de Saint Ju',
    reference: 'CLI-0002',
    city: 'Le Lamentin',
    status: 'active',
    created_at: '2026-09-10T18:24:25.550435+00:00',
  },
  {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Tricatel — FICTIF SUPER PDP',
    reference: 'CLI-0001',
    city: 'Fort-de-France',
    status: 'active',
    created_at: '2026-09-04T22:28:52.657864+00:00',
  },
];

Deno.test('sortCustomersByCreation place le client le plus ancien en premier', () => {
  assertEquals(
    sortCustomersByCreation(customers).map((customer) => customer.reference),
    ['CLI-0001', 'CLI-0002'],
  );
});

Deno.test('answerFirstCustomerQuestion répond directement avec le premier client réel', () => {
  const answer = answerFirstCustomerQuestion(
    "Mon premier client, ce n'est pas Tricatel ?",
    customers,
  );

  assertStringIncludes(answer ?? '', 'Tricatel — FICTIF SUPER PDP');
  assertStringIncludes(answer ?? '', 'CLI-0001');
  assertStringIncludes(answer ?? '', 'avant **Mairie de Saint Ju**');
});

Deno.test('answerFirstCustomerQuestion laisse les autres questions au moteur principal', () => {
  assertEquals(answerFirstCustomerQuestion('Combien ai-je de clients ?', customers), null);
});
