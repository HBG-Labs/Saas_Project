import type { Extensions } from '@tiptap/core';
import Bold from '@tiptap/extension-bold';
import Document from '@tiptap/extension-document';
import HardBreak from '@tiptap/extension-hard-break';
import Heading from '@tiptap/extension-heading';
import Italic from '@tiptap/extension-italic';
import { BulletList, ListItem, OrderedList } from '@tiptap/extension-list';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { UndoRedo } from '@tiptap/extensions';

/** Le schéma minimal de l'éditeur Workspace, partagé avec les tests clavier. */
export function createWorkspaceEditorExtensions(): Extensions {
  return [
    Document,
    Paragraph,
    Text,
    HardBreak,
    Bold,
    Italic,
    Heading.configure({ levels: [2] }),
    ListItem,
    BulletList,
    OrderedList,
    UndoRedo,
  ];
}
