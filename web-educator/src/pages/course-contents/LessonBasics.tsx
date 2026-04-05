import React from "react";
import type { Lesson } from "./types";

interface LessonBasicsProps {
  lesson: Lesson;
  onUpdate: (updates: Partial<Lesson>) => void;
}

const LessonBasics: React.FC<LessonBasicsProps> = ({ lesson, onUpdate }) => (
  <div className="space-y-4">
    <input
      value={lesson.title}
      onChange={(event) => onUpdate({ title: event.target.value })}
      className="w-full text-3xl md:text-4xl font-semibold text-slate-900 bg-transparent focus:outline-none"
      placeholder="Lesson title"
    />
    <textarea
      value={lesson.description}
      onChange={(event) => onUpdate({ description: event.target.value })}
      className="w-full resize-none rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-600 focus:border-emerald-400 focus:outline-none"
      rows={3}
      placeholder="Lesson description"
    />
  </div>
);

export default LessonBasics;
