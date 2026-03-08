import React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import type { JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Youtube from "@tiptap/extension-youtube";

interface EditorProps {
  content: JSONContent;
  onChange: (content: JSONContent) => void;
}

const Editor: React.FC<EditorProps> = ({ content, onChange }) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link,
      Image,
      Youtube.configure({
        controls: false,
        nocookie: true,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON());
    },
  });

  if (!editor) return null;

  const addImage = () => {
    const url = window.prompt("Enter image URL");
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  const addVideo = () => {
    const url = window.prompt("Enter YouTube URL");
    if (url) editor.chain().focus().setYoutubeVideo({ src: url }).run();
  };

  return (
    <div className="editor-container border rounded p-4">
      <div className="toolbar mb-2 flex gap-2">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className="px-2 py-1 bg-gray-200 rounded"
        >
          Bold
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className="px-2 py-1 bg-gray-200 rounded"
        >
          Italic
        </button>
        <button
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          className="px-2 py-1 bg-gray-200 rounded"
        >
          H1
        </button>
        <button
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          className="px-2 py-1 bg-gray-200 rounded"
        >
          H2
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className="px-2 py-1 bg-gray-200 rounded"
        >
          Bullet List
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className="px-2 py-1 bg-gray-200 rounded"
        >
          Ordered List
        </button>
        <button onClick={addImage} className="px-2 py-1 bg-gray-200 rounded">
          Image
        </button>
        <button onClick={addVideo} className="px-2 py-1 bg-gray-200 rounded">
          Video
        </button>
      </div>
      <EditorContent editor={editor} className="prose max-w-full" />
    </div>
  );
};

export default Editor;
