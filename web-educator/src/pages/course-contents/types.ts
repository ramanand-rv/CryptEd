import type { JSONContent } from "@tiptap/react";

export interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
}

export interface QuizPayload {
  id?: string;
  title: string;
  description: string;
  tags: string[];
  questions: QuizQuestion[];
}

export interface PendingQuiz {
  lessonId: string;
  quiz: QuizPayload;
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  content: JSONContent;
}

export interface StoredState {
  lessons: Lesson[];
  collapsedLessonIds: string[];
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  selectedLessonId?: string | null;
}
