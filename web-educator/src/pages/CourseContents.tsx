import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { JSONContent } from "@tiptap/react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
}

interface LessonQuiz {
  id: string;
  topic: string;
  description: string;
  tags: string[];
  questions: QuizQuestion[];
}

interface Lesson {
  id: string;
  title: string;
  description: string;
  content: JSONContent;
  quizzes: LessonQuiz[];
}

interface QuizDraft {
  topic: string;
  description: string;
  tags: string;
  numQuestions: number;
  generating: boolean;
}

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const parseTags = (tags: unknown): string[] => {
  if (Array.isArray(tags)) {
    return tags.map((tag) => String(tag).trim()).filter(Boolean);
  }
  if (typeof tags === "string") {
    return tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
};

const CourseContents: React.FC = () => {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [courseTitle, setCourseTitle] = useState("");
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [legacyBlocks, setLegacyBlocks] = useState<any[]>([]);
  const [hasLegacy, setHasLegacy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, QuizDraft>>({});
  const [draggingLessonId, setDraggingLessonId] = useState<string | null>(null);

  useEffect(() => {
    const fetchCourse = async () => {
      try {
        const res = await api.get(`/courses/${id}`, {
          headers: token ? { "x-auth-token": token } : undefined,
        });
        const course = res.data;
        setCourseTitle(course?.title || "Course");

        const blocks = Array.isArray(course?.content)
          ? course.content
          : Array.isArray(course?.content?.content)
            ? course.content.content
            : [];

        const parsedLessons: Lesson[] = [];
        const extras: any[] = [];
        let currentLesson: Lesson | null = null;
        let legacyDetected = false;

        blocks.forEach((block: any) => {
          if (block?.type === "lesson") {
            const lessonId = block?.attrs?.lessonId || createId();
            currentLesson = {
              id: lessonId,
              title: block?.attrs?.title || "Untitled lesson",
              description: block?.attrs?.description || "",
              content:
                block?.attrs?.content || {
                  type: "doc",
                  content: [{ type: "paragraph" }],
                },
              quizzes: [],
            };
            parsedLessons.push(currentLesson);
            return;
          }

          if (block?.type === "quiz") {
            if (!currentLesson) {
              currentLesson = {
                id: createId(),
                title: "Lesson 1",
                description: "",
                content: { type: "doc", content: [{ type: "paragraph" }] },
                quizzes: [],
              };
              parsedLessons.push(currentLesson);
            }
            currentLesson.quizzes.push({
              id: block?.attrs?.quizId || createId(),
              topic: block?.attrs?.topic || "",
              description: block?.attrs?.description || "",
              tags: parseTags(block?.attrs?.tags),
              questions: Array.isArray(block?.attrs?.questions)
                ? block.attrs.questions
                : [],
            });
            return;
          }

          if (block) {
            legacyDetected = true;
            extras.push(block);
          }
        });

        if (parsedLessons.length === 0) {
          parsedLessons.push({
            id: createId(),
            title: "Lesson 1",
            description: "",
            content: { type: "doc", content: [{ type: "paragraph" }] },
            quizzes: [],
          });
        }

        setLessons(parsedLessons);
        setLegacyBlocks(extras);
        setHasLegacy(legacyDetected);
      } catch (err) {
        console.error(err);
        setError("Unable to load course contents.");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchCourse();
    }
  }, [id, token]);

  const updateLesson = (lessonId: string, updates: Partial<Lesson>) => {
    setLessons((prev) =>
      prev.map((lesson) =>
        lesson.id === lessonId ? { ...lesson, ...updates } : lesson,
      ),
    );
  };

  const updateQuiz = (
    lessonId: string,
    quizId: string,
    updates: Partial<LessonQuiz>,
  ) => {
    setLessons((prev) =>
      prev.map((lesson) => {
        if (lesson.id !== lessonId) return lesson;
        return {
          ...lesson,
          quizzes: lesson.quizzes.map((quiz) =>
            quiz.id === quizId ? { ...quiz, ...updates } : quiz,
          ),
        };
      }),
    );
  };

  const addLesson = () => {
    setLessons((prev) => [
      ...prev,
      {
        id: createId(),
        title: "New lesson",
        description: "",
        content: { type: "doc", content: [{ type: "paragraph" }] },
        quizzes: [],
      },
    ]);
  };

  const deleteLesson = (lessonId: string) => {
    setLessons((prev) => prev.filter((lesson) => lesson.id !== lessonId));
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[lessonId];
      return next;
    });
  };

  const deleteQuiz = (lessonId: string, quizId: string) => {
    setLessons((prev) =>
      prev.map((lesson) => {
        if (lesson.id !== lessonId) return lesson;
        return {
          ...lesson,
          quizzes: lesson.quizzes.filter((quiz) => quiz.id !== quizId),
        };
      }),
    );
  };

  const getDraft = (lessonId: string, fallback: Lesson): QuizDraft => {
    const base =
      drafts[lessonId] || {
        topic: fallback.title,
        description: fallback.description,
        tags: "",
        numQuestions: 5,
        generating: false,
      };

    return {
      ...base,
      topic: base.topic || fallback.title,
      description: base.description || fallback.description,
    };
  };

  const updateDraft = (lessonId: string, updates: Partial<QuizDraft>) => {
    setDrafts((prev) => {
      const base =
        prev[lessonId] || {
          topic: "",
          description: "",
          tags: "",
          numQuestions: 5,
          generating: false,
        };
      return {
        ...prev,
        [lessonId]: { ...base, ...updates },
      };
    });
  };

  const handleGenerateQuiz = async (lesson: Lesson) => {
    const draft = getDraft(lesson.id, lesson);
    if (!draft.topic.trim() || !draft.description.trim()) {
      setError("Provide a quiz topic and description before generating.");
      return;
    }

    updateDraft(lesson.id, { generating: true });
    setError(null);

    try {
      const res = await api.post(
        "/courses/generate-quiz",
        {
          topic: draft.topic.trim(),
          description: draft.description.trim(),
          tags: parseTags(draft.tags),
          numQuestions: draft.numQuestions,
        },
        { headers: { "x-auth-token": token } },
      );

      const questions = Array.isArray(res.data.questions) ? res.data.questions : [];
    const newQuiz: LessonQuiz = {
      id: createId(),
      topic: draft.topic.trim(),
      description: draft.description.trim(),
      tags: parseTags(draft.tags),
      questions,
    };

      setLessons((prev) =>
        prev.map((item) =>
          item.id === lesson.id
            ? { ...item, quizzes: [...item.quizzes, newQuiz] }
            : item,
        ),
      );
    } catch (err: any) {
      console.error(err);
      const message =
        err?.response?.data?.msg ||
        err?.response?.data?.error ||
        "Failed to generate quiz.";
      setError(message);
    } finally {
      updateDraft(lesson.id, { generating: false });
    }
  };

  const saveContents = async () => {
    if (!id) return;
    setSaving(true);
    setError(null);

    const flattened = lessons.flatMap((lesson) => [
      {
        type: "lesson",
        attrs: {
          lessonId: lesson.id,
          title: lesson.title.trim() || "Untitled lesson",
          description: lesson.description.trim(),
          content: lesson.content,
        },
      },
      ...lesson.quizzes.map((quiz) => ({
        type: "quiz",
        attrs: {
          quizId: quiz.id,
          lessonId: lesson.id,
          topic: quiz.topic.trim(),
          description: quiz.description.trim(),
          tags: quiz.tags,
          questions: quiz.questions,
        },
      })),
    ]);

    const nextContent = hasLegacy
      ? [...flattened, ...legacyBlocks]
      : flattened;

    try {
      await api.put(
        `/courses/${id}`,
        { content: nextContent },
        { headers: { "x-auth-token": token } },
      );
      navigate(`/courses/${id}`);
    } catch (err: any) {
      console.error(err);
      const message =
        err?.response?.data?.msg ||
        err?.response?.data?.error ||
        "Failed to save course contents.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const hasNoLessons = useMemo(() => lessons.length === 0, [lessons.length]);

  const handleDragStart = (lessonId: string) => {
    setDraggingLessonId(lessonId);
  };

  const handleDrop = (targetLessonId: string) => {
    if (!draggingLessonId || draggingLessonId === targetLessonId) {
      setDraggingLessonId(null);
      return;
    }
    setLessons((prev) => {
      const fromIndex = prev.findIndex((lesson) => lesson.id === draggingLessonId);
      const toIndex = prev.findIndex((lesson) => lesson.id === targetLessonId);
      if (fromIndex < 0 || toIndex < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    setDraggingLessonId(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <Link to={`/courses/${id}`} className="text-xs uppercase text-emerald-600">
              Back to course dashboard
            </Link>
            <h1 className="text-3xl md:text-4xl font-semibold text-slate-900 mt-2">
              Course contents
            </h1>
            <p className="text-sm text-slate-600 mt-2 max-w-2xl">
              Organize lessons and quizzes for {courseTitle}.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={addLesson}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 transition"
            >
              Add lesson
            </button>
            <button
              type="button"
              onClick={saveContents}
              disabled={saving || hasNoLessons}
              className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save contents"}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {hasLegacy && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Legacy content blocks were detected. They will be preserved at the end
            of the course when you save, but they are not editable here yet.
          </div>
        )}

        {hasNoLessons ? (
          <div className="rounded-3xl border border-white/60 bg-white/70 p-12 text-center shadow-soft">
            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              No lessons yet
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              Add your first lesson to start building the course content.
            </p>
            <button
              type="button"
              onClick={addLesson}
              className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition"
            >
              Add lesson
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {lessons.map((lesson, lessonIndex) => {
              const draft = getDraft(lesson.id, lesson);
              return (
                <div
                  key={lesson.id}
                  draggable
                  onDragStart={() => handleDragStart(lesson.id)}
                  onDragEnd={() => setDraggingLessonId(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => handleDrop(lesson.id)}
                  className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-soft space-y-5"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-[0.2em] text-emerald-600">
                      Lesson {lessonIndex + 1}
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">
                        Drag to reorder
                      </span>
                      <Link
                        to={`/courses/${id}/lessons/${lesson.id}/edit`}
                        className="text-xs font-semibold uppercase text-emerald-600"
                      >
                        Edit content
                      </Link>
                      <button
                        type="button"
                        onClick={() => deleteLesson(lesson.id)}
                        className="text-xs font-semibold uppercase text-rose-500"
                      >
                        Delete lesson
                      </button>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">
                        Lesson title
                      </label>
                      <input
                        type="text"
                        value={lesson.title}
                        onChange={(e) =>
                          updateLesson(lesson.id, { title: e.target.value })
                        }
                        className="w-full mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">
                        Lesson description
                      </label>
                      <textarea
                        value={lesson.description}
                        onChange={(e) =>
                          updateLesson(lesson.id, {
                            description: e.target.value,
                          })
                        }
                        className="w-full mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        rows={3}
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-white p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          Quizzes
                        </h3>
                        <p className="text-xs text-slate-500">
                          Add or edit quizzes for this lesson.
                        </p>
                      </div>
                      <span className="text-xs text-slate-400">
                        {lesson.quizzes.length} total
                      </span>
                    </div>

                    {lesson.quizzes.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        No quizzes yet. Generate one below.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {lesson.quizzes.map((quiz) => (
                          <div
                            key={quiz.id}
                            className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-slate-900">
                                {quiz.topic || "Untitled quiz"}
                              </p>
                              <button
                                type="button"
                                onClick={() => deleteQuiz(lesson.id, quiz.id)}
                                className="text-xs font-semibold uppercase text-rose-500"
                              >
                                Delete quiz
                              </button>
                            </div>

                            <div className="grid md:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-slate-600">
                                  Quiz topic
                                </label>
                                <input
                                  type="text"
                                  value={quiz.topic}
                                  onChange={(e) =>
                                    updateQuiz(lesson.id, quiz.id, {
                                      topic: e.target.value,
                                    })
                                  }
                                  className="w-full mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-600">
                                  Tags
                                </label>
                                <input
                                  type="text"
                                  value={quiz.tags.join(", ")}
                                  onChange={(e) =>
                                    updateQuiz(lesson.id, quiz.id, {
                                      tags: parseTags(e.target.value),
                                    })
                                  }
                                  className="w-full mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-slate-600">
                                Quiz description
                              </label>
                              <textarea
                                value={quiz.description}
                                onChange={(e) =>
                                  updateQuiz(lesson.id, quiz.id, {
                                    description: e.target.value,
                                  })
                                }
                                className="w-full mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                                rows={2}
                              />
                            </div>

                            {quiz.questions.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-xs uppercase text-slate-400">
                                  Questions
                                </p>
                                {quiz.questions.map((q, idx) => (
                                  <div
                                    key={`${quiz.id}-${idx}`}
                                    className="rounded-xl border border-slate-100 bg-white px-3 py-2 text-xs text-slate-600"
                                  >
                                    {idx + 1}. {q.question}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 space-y-3">
                      <p className="text-xs uppercase text-emerald-600">
                        Generate new quiz
                      </p>
                      <div className="grid md:grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={draft.topic}
                          onChange={(e) =>
                            updateDraft(lesson.id, { topic: e.target.value })
                          }
                          className="w-full rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                          placeholder="Quiz topic"
                        />
                        <input
                          type="text"
                          value={draft.tags}
                          onChange={(e) =>
                            updateDraft(lesson.id, { tags: e.target.value })
                          }
                          className="w-full rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                          placeholder="Tags (comma separated)"
                        />
                      </div>
                      <textarea
                        value={draft.description}
                        onChange={(e) =>
                          updateDraft(lesson.id, { description: e.target.value })
                        }
                        className="w-full rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        rows={2}
                        placeholder="Quiz description"
                      />
                      <div className="flex flex-wrap items-center gap-3">
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={draft.numQuestions}
                          onChange={(e) =>
                            updateDraft(lesson.id, {
                              numQuestions: Number(e.target.value),
                            })
                          }
                          className="w-32 rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        />
                        <button
                          type="button"
                          onClick={() => handleGenerateQuiz(lesson)}
                          disabled={draft.generating}
                          className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-60"
                        >
                          {draft.generating ? "Generating..." : "Generate quiz"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CourseContents;
