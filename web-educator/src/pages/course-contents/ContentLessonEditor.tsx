import React from "react";
import type { JSONContent } from "@tiptap/react";
import Editor from "../../components/Editor";
import type { Lesson, QuizPayload } from "./types";

interface ContentLessonEditorProps {
  lesson: Lesson;
  onDelete: () => void;
  onChangeContent: (content: JSONContent) => void;
  onAddQuiz: () => void;
  onEditQuiz?: (quiz: QuizPayload) => void;
}

const ContentLessonEditor: React.FC<ContentLessonEditorProps> = ({
  lesson,
  onDelete,
  onChangeContent,
  onAddQuiz,
  onEditQuiz,
}) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          Lesson Editor
        </p>
        <p className="text-sm text-slate-500">
          Type / to insert blocks, images, or lists.
        </p>
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="text-xs uppercase font-semibold text-rose-500"
      >
        Delete lesson
      </button>
    </div>
    <Editor
      key={lesson.id}
      content={lesson.content}
      onChange={onChangeContent}
      onAddQuiz={onAddQuiz}
      onEditQuiz={onEditQuiz}
    />
  </div>
);

export default ContentLessonEditor;
