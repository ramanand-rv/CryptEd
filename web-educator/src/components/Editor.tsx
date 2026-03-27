import React, { useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import type { JSONContent } from "@tiptap/react";
import { Node, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Youtube from "@tiptap/extension-youtube";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";

interface EditorProps {
  content: JSONContent;
  onChange: (content: JSONContent) => void;
  onAddQuiz?: () => void;
}

interface SlashPosition {
  top: number;
  left: number;
}

interface SlashRange {
  from: number;
  to: number;
}

interface CommandItem {
  id: string;
  label: string;
  description: string;
  keywords: string[];
  action: (editor: ReturnType<typeof useEditor>) => void;
}

const QuizNode = Node.create({
  name: "quiz",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      title: { default: "Quiz" },
      description: { default: "" },
      tags: { default: [] },
      questions: { default: [] },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-type='quiz']" }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const questionCount = Array.isArray(node.attrs.questions)
      ? node.attrs.questions.length
      : 0;
    const children: any[] = [
      ["div", { class: "quiz-node__title" }, node.attrs.title || "Quiz"],
    ];
    if (node.attrs.description) {
      children.push(["div", { class: "quiz-node__desc" }, node.attrs.description]);
    }
    children.push([
      "div",
      { class: "quiz-node__meta" },
      `${questionCount} question${questionCount === 1 ? "" : "s"}`,
    ]);

    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "quiz",
        class: "quiz-node",
      }),
      ...children,
    ];
  },
});

const Editor: React.FC<EditorProps> = ({ content, onChange, onAddQuiz }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const filteredCommandsRef = useRef<CommandItem[]>([]);
  const slashOpenRef = useRef(false);
  const activeIndexRef = useRef(0);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashPosition, setSlashPosition] = useState<SlashPosition | null>(null);
  const [slashRange, setSlashRange] = useState<SlashRange | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit,
      QuizNode,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Placeholder.configure({
        placeholder: "Type '/' for commands...",
      }),
      Link.configure({
        openOnClick: false,
      }),
      Image,
      Youtube.configure({
        controls: false,
        nocookie: true,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON());

      const { state, view } = editor;
      const { $from } = state.selection;
      const parentStart = $from.start();
      const textBefore = state.doc.textBetween(parentStart, $from.pos, "\n", "\n");
      const match = /(^|\s)\/([a-zA-Z0-9-]*)$/.exec(textBefore);

      if (!match) {
        setSlashOpen(false);
        setSlashQuery("");
        setSlashRange(null);
        setSlashPosition(null);
        return;
      }

      const commandText = match[0].replace(/^\\s+/, "");
      const from = $from.pos - commandText.length;
      const to = $from.pos;
      const coords = view.coordsAtPos(to);
      const containerRect = containerRef.current?.getBoundingClientRect();

      if (containerRect) {
        setSlashPosition({
          top: coords.top - containerRect.top + 28,
          left: coords.left - containerRect.left,
        });
      }

      setSlashRange({ from, to });
      setSlashQuery(match[2] || "");
      setSlashOpen(true);
    },
    editorProps: {
      attributes: {
        class:
          "min-h-[520px] w-full px-10 py-8 text-[15px] leading-7 text-slate-900 focus:outline-none",
      },
      handleKeyDown: (_, event) => {
        if (!slashOpenRef.current) return false;
        const commandList = filteredCommandsRef.current;
        if (commandList.length === 0) return false;
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setActiveIndex((prev) => (prev + 1) % commandList.length);
          return true;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setActiveIndex((prev) =>
            prev - 1 < 0 ? commandList.length - 1 : prev - 1,
          );
          return true;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          const command = commandList[activeIndexRef.current];
          if (command) runCommand(command);
          return true;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          setSlashOpen(false);
          return true;
        }
        return false;
      },
    },
  });

  if (!editor) return null;

  const commands: CommandItem[] = useMemo(
    () => [
      {
        id: "text",
        label: "Text",
        description: "Start writing with plain text.",
        keywords: ["paragraph", "plain"],
        action: (editorInstance) => editorInstance?.chain().focus().setParagraph().run(),
      },
      {
        id: "heading-1",
        label: "Heading 1",
        description: "Large section heading.",
        keywords: ["h1", "title"],
        action: (editorInstance) =>
          editorInstance?.chain().focus().toggleHeading({ level: 1 }).run(),
      },
      {
        id: "heading-2",
        label: "Heading 2",
        description: "Medium section heading.",
        keywords: ["h2", "subtitle"],
        action: (editorInstance) =>
          editorInstance?.chain().focus().toggleHeading({ level: 2 }).run(),
      },
      {
        id: "heading-3",
        label: "Heading 3",
        description: "Small section heading.",
        keywords: ["h3"],
        action: (editorInstance) =>
          editorInstance?.chain().focus().toggleHeading({ level: 3 }).run(),
      },
      {
        id: "bullet-list",
        label: "Bullet List",
        description: "Create a simple bulleted list.",
        keywords: ["ul", "list"],
        action: (editorInstance) =>
          editorInstance?.chain().focus().toggleBulletList().run(),
      },
      {
        id: "ordered-list",
        label: "Numbered List",
        description: "Create a numbered list.",
        keywords: ["ol", "list"],
        action: (editorInstance) =>
          editorInstance?.chain().focus().toggleOrderedList().run(),
      },
      {
        id: "task-list",
        label: "To-do List",
        description: "Add checkboxes for tasks.",
        keywords: ["todo", "task", "checkbox"],
        action: (editorInstance) =>
          editorInstance?.chain().focus().toggleTaskList().run(),
      },
      {
        id: "code-block",
        label: "Code Block",
        description: "Insert a code snippet.",
        keywords: ["code", "snippet"],
        action: (editorInstance) =>
          editorInstance?.chain().focus().toggleCodeBlock().run(),
      },
      {
        id: "quote",
        label: "Quote",
        description: "Insert a quoted block.",
        keywords: ["blockquote"],
        action: (editorInstance) =>
          editorInstance?.chain().focus().toggleBlockquote().run(),
      },
      {
        id: "divider",
        label: "Divider",
        description: "Insert a horizontal rule.",
        keywords: ["hr", "separator"],
        action: (editorInstance) => editorInstance?.chain().focus().setHorizontalRule().run(),
      },
      {
        id: "image",
        label: "Image",
        description: "Embed an image from a URL.",
        keywords: ["photo", "media"],
        action: (editorInstance) => {
          const url = window.prompt("Enter image URL");
          if (url) editorInstance?.chain().focus().setImage({ src: url }).run();
        },
      },
      {
        id: "video",
        label: "YouTube",
        description: "Embed a YouTube video.",
        keywords: ["video", "youtube"],
        action: (editorInstance) => {
          const url = window.prompt("Enter YouTube URL");
          if (url) editorInstance?.chain().focus().setYoutubeVideo({ src: url }).run();
        },
      },
      {
        id: "link",
        label: "Link",
        description: "Create a link from selected text.",
        keywords: ["url"],
        action: (editorInstance) => {
          const url = window.prompt("Enter URL");
          if (url) {
            editorInstance
              ?.chain()
              .focus()
              .extendMarkRange("link")
              .setLink({ href: url })
              .run();
          }
        },
      },
    ],
    [],
  );

  const filteredCommands = useMemo(() => {
    const query = slashQuery.trim().toLowerCase();
    if (!query) return commands;
    return commands.filter((command) => {
      if (command.label.toLowerCase().includes(query)) return true;
      return command.keywords.some((keyword) => keyword.includes(query));
    });
  }, [commands, slashQuery]);

  useEffect(() => {
    setActiveIndex(0);
  }, [slashQuery, slashOpen]);

  useEffect(() => {
    filteredCommandsRef.current = filteredCommands;
  }, [filteredCommands]);

  useEffect(() => {
    slashOpenRef.current = slashOpen;
  }, [slashOpen]);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  const runCommand = (command: CommandItem) => {
    if (!editor) return;
    if (slashRange) {
      editor.chain().focus().deleteRange(slashRange).run();
    }
    command.action(editor);
    setSlashOpen(false);
    setSlashQuery("");
  };

  const addImage = () => {
    const url = window.prompt("Enter image URL");
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  const addVideo = () => {
    const url = window.prompt("Enter YouTube URL");
    if (url) editor.chain().focus().setYoutubeVideo({ src: url }).run();
  };

  const setLink = () => {
    const url = window.prompt("Enter URL");
    if (url) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  };

  const buttonClass = (isActive = false) =>
    `px-3 py-2 rounded-xl text-[11px] font-semibold uppercase tracking-wide transition-colors ${
      isActive
        ? "bg-slate-900 text-white shadow-soft"
        : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200"
    }`;

  return (
    <div
      ref={containerRef}
      className="editor-container relative border border-slate-200 rounded-3xl shadow-soft bg-white/95 overflow-hidden"
    >
      <style>
        {`
          .editor-container ul[data-type="taskList"] {
            list-style: none;
            padding-left: 1.75rem;
          }
          .editor-container li[data-type="taskItem"] {
            display: flex;
            gap: 0.6rem;
            align-items: flex-start;
          }
          .editor-container li[data-type="taskItem"] > label {
            margin-top: 0.2rem;
          }
          .editor-container li[data-type="taskItem"] > div {
            flex: 1;
          }
          .editor-container .quiz-node {
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            background: #f8fafc;
            padding: 14px 16px;
            margin: 12px 0;
          }
          .editor-container .quiz-node__title {
            font-weight: 600;
            color: #0f172a;
            margin-bottom: 4px;
          }
          .editor-container .quiz-node__desc {
            font-size: 0.85rem;
            color: #64748b;
            margin-bottom: 6px;
          }
          .editor-container .quiz-node__meta {
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.2em;
            color: #94a3b8;
          }
        `}
      </style>
      <div className="toolbar bg-white/80 border-b border-slate-200 px-4 py-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={buttonClass(editor.isActive("bold"))}
        >
          Bold
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={buttonClass(editor.isActive("italic"))}
        >
          Italic
        </button>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={buttonClass(editor.isActive("strike"))}
        >
          Strike
        </button>
        <div className="w-px h-6 bg-gray-300 mx-1"></div>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={buttonClass(editor.isActive("heading", { level: 1 }))}
        >
          H1
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={buttonClass(editor.isActive("heading", { level: 2 }))}
        >
          H2
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={buttonClass(editor.isActive("heading", { level: 3 }))}
        >
          H3
        </button>
        <div className="w-px h-6 bg-gray-300 mx-1"></div>
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={buttonClass(editor.isActive("bulletList"))}
        >
          Bullet List
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={buttonClass(editor.isActive("orderedList"))}
        >
          Ordered List
        </button>
        <button
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={buttonClass(editor.isActive("taskList"))}
        >
          To-do
        </button>
        <button
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={buttonClass(editor.isActive("codeBlock"))}
        >
          Code
        </button>
        <div className="w-px h-6 bg-gray-300 mx-1"></div>
        <button onClick={addImage} className={buttonClass()}>
          Image
        </button>
        <button onClick={addVideo} className={buttonClass()}>
          Video
        </button>
        <button onClick={setLink} className={buttonClass()}>
          Link
        </button>
        {onAddQuiz && (
          <>
            <div className="w-px h-6 bg-gray-300 mx-1"></div>
            <button onClick={onAddQuiz} className={buttonClass()}>
              Quiz
            </button>
          </>
        )}
      </div>
      <EditorContent editor={editor} />

      {slashOpen && slashPosition && filteredCommands.length > 0 && (
        <div
          className="absolute z-20 w-72 rounded-2xl border border-slate-200 bg-white shadow-xl p-2"
          style={{ top: slashPosition.top, left: slashPosition.left }}
        >
          <p className="px-2 pt-2 pb-1 text-[11px] uppercase tracking-[0.2em] text-slate-400">
            Blocks
          </p>
          <div className="max-h-72 overflow-y-auto">
            {filteredCommands.map((command, index) => (
              <button
                key={command.id}
                type="button"
                onClick={() => runCommand(command)}
                className={`w-full text-left rounded-xl px-3 py-2 transition ${
                  index === activeIndex
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <p className="text-sm font-medium">{command.label}</p>
                <p className="text-xs text-slate-400">{command.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {slashOpen && slashPosition && filteredCommands.length === 0 && (
        <div
          className="absolute z-20 w-64 rounded-2xl border border-slate-200 bg-white shadow-xl px-4 py-3 text-sm text-slate-500"
          style={{ top: slashPosition.top, left: slashPosition.left }}
        >
          No matching commands.
        </div>
      )}
    </div>
  );
};

export default Editor;
