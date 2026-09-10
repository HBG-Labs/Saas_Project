import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';

import {
  answerDocumentCatalogQuestion,
  asksForDocumentCatalog,
  findMentionedDocument,
  type AiDocumentCatalogItem,
} from './ai-document-catalog.ts';

const documents: AiDocumentCatalogItem[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    title: 'Annonce du 05 septembre 2026',
    filename: 'Annonce du 05 septembre 2026.pdf',
    category: null,
    status: 'ready',
    created_at: '2026-09-08T17:14:50.067363+00:00',
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    title: 'Invoice-PBDWCS-00001',
    filename: 'Invoice-PBDWCS-00001.pdf',
    category: null,
    status: 'ready',
    created_at: '2026-09-08T10:02:55.748898+00:00',
  },
];

Deno.test('détecte une question sur les documents indexés', () => {
  assertEquals(asksForDocumentCatalog("J'ai ajouté un document, tu le vois ?"), true);
  assertEquals(asksForDocumentCatalog('Est-ce que mes PDF sont indexés ?'), true);
  assertEquals(asksForDocumentCatalog("Résume le contenu d'un document"), false);
});

Deno.test('énumère les documents réellement prêts', () => {
  const answer = answerDocumentCatalogQuestion('Quels documents vois-tu ?', documents);

  assertStringIncludes(answer ?? '', '2 documents');
  assertStringIncludes(answer ?? '', 'Annonce du 05 septembre 2026');
  assertStringIncludes(answer ?? '', 'Invoice-PBDWCS-00001');
  assertStringIncludes(answer ?? '', 'indexés et prêts');
});

Deno.test('reconnaît un document nommé avec un titre abrégé', () => {
  assertEquals(
    findMentionedDocument("Résume l'annonce du 05 septembre", documents)?.id,
    documents[0]?.id,
  );
  assertEquals(
    findMentionedDocument('Que contient Invoice-PBDWCS-00001 ?', documents)?.id,
    documents[1]?.id,
  );
});
