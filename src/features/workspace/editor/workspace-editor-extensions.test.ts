import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';

import { createWorkspaceEditorExtensions } from './workspace-editor-extensions';

let editor: Editor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
});

function createEditor() {
  const element = document.createElement('div');
  document.body.appendChild(element);
  editor = new Editor({
    element,
    extensions: createWorkspaceEditorExtensions(),
    content: '<p>Première ligne</p>',
  });
  editor.commands.focus('end');
  return editor;
}

function pressEnter(target: Editor, shiftKey = false) {
  target.view.dom.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', shiftKey, bubbles: true }),
  );
}

describe('éditeur Workspace — retours à la ligne', () => {
  it('Entrée crée un nouveau paragraphe', () => {
    const current = createEditor();
    pressEnter(current);

    expect(current.getJSON().content?.map((node) => node.type)).toEqual(['paragraph', 'paragraph']);
  });

  it('Shift+Entrée crée un hardBreak dans le même paragraphe', () => {
    const current = createEditor();
    pressEnter(current, true);

    expect(current.getJSON().content).toHaveLength(1);
    const nodeTypes = current
      .getJSON()
      .content?.[0]?.content?.map((node: { type?: string }) => node.type);

    expect(nodeTypes).toEqual(['text', 'hardBreak']);
  });
});
