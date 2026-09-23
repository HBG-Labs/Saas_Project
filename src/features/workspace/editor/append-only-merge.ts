import type { JSONContent } from '@tiptap/core';

import type { TiptapDocument } from '@/types/database';

function sameNode(left: JSONContent, right: JSONContent) {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Returns only the blocks that the server appended to a previously loaded
 * document. Any edit, deletion or reordering of an existing block is treated
 * as a real conflict and therefore returns null.
 */
export function getAppendOnlySuffix(
  previous: TiptapDocument,
  incoming: TiptapDocument,
): JSONContent[] | null {
  const previousContent = (previous.content ?? []) as JSONContent[];
  const incomingContent = (incoming.content ?? []) as JSONContent[];

  if (incomingContent.length < previousContent.length) return null;
  if (
    !previousContent.every((node, index) => {
      const incomingNode = incomingContent[index];
      return incomingNode !== undefined && sameNode(node, incomingNode);
    })
  )
    return null;

  return incomingContent.slice(previousContent.length);
}

export function appendDocumentBlocks(local: TiptapDocument, blocks: JSONContent[]): TiptapDocument {
  return {
    ...local,
    content: [...((local.content ?? []) as JSONContent[]), ...blocks],
  };
}
