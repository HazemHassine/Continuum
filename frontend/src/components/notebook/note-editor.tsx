"use client";

import { useCreateBlockNote } from "@blocknote/react";
import {
  BlockNoteSchema,
  defaultBlockSpecs,
  type PartialBlock,
} from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";

const schema = BlockNoteSchema.create({
  blockSpecs: {
    paragraph: defaultBlockSpecs.paragraph,
    heading: defaultBlockSpecs.heading,
    bulletListItem: defaultBlockSpecs.bulletListItem,
    numberedListItem: defaultBlockSpecs.numberedListItem,
    checkListItem: defaultBlockSpecs.checkListItem,
  },
});

export default function NoteEditor({
  content,
  onChange,
  readOnly = false,
}: {
  content: unknown[];
  onChange: (content: unknown[]) => void;
  readOnly?: boolean;
}) {
  const editor = useCreateBlockNote({
    schema,
    initialContent: content.length
      ? (content as PartialBlock<typeof schema.blockSchema>[])
      : undefined,
  });
  return (
    <div className="notebook-editor">
      <BlockNoteView
        editor={editor}
        theme="light"
        editable={!readOnly}
        onChange={() => onChange(editor.document)}
      />
    </div>
  );
}
