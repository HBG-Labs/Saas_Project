import { describe, expect, it } from 'vitest';

import type { TiptapDocument } from '@/types/database';

import { appendDocumentBlocks, getAppendOnlySuffix } from './append-only-merge';

const paragraph = (text: string) => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
});

describe('fusion append-only du Workspace', () => {
  it('isole une transcription ajoutée à la fin par le serveur', () => {
    const previous: TiptapDocument = { type: 'doc', content: [paragraph('Note locale')] };
    const incoming: TiptapDocument = {
      type: 'doc',
      content: [paragraph('Note locale'), paragraph('Transcription')],
    };

    expect(getAppendOnlySuffix(previous, incoming)).toEqual([paragraph('Transcription')]);
  });

  it('fusionne les blocs serveur sans perdre la saisie locale', () => {
    const local: TiptapDocument = {
      type: 'doc',
      content: [paragraph('Note locale'), paragraph('Saisie non enregistrée')],
    };

    expect(appendDocumentBlocks(local, [paragraph('Transcription')]).content).toEqual([
      paragraph('Note locale'),
      paragraph('Saisie non enregistrée'),
      paragraph('Transcription'),
    ]);
  });

  it('refuse la fusion si un bloc existant a été modifié', () => {
    const previous: TiptapDocument = { type: 'doc', content: [paragraph('Avant')] };
    const incoming: TiptapDocument = {
      type: 'doc',
      content: [paragraph('Modifié'), paragraph('Transcription')],
    };

    expect(getAppendOnlySuffix(previous, incoming)).toBeNull();
  });
});
