import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
}

interface QuizPayload {
  id?: string;
  title: string;
  description: string;
  tags: string[];
  questions: QuizQuestion[];
}

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const GenerateQuiz: React.FC = () => {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const queryParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  const returnTo = queryParams.get("returnTo") || `/courses/${id}/contents`;
  const lessonId = queryParams.get("lessonId") || "";

  const [targetLessonId, setTargetLessonId] = useState(lessonId);
  const [loading, setLoading] = useState(true);
  const [topic, setTopic] = useState(queryParams.get("topic") || "");
  const [description, setDescription] = useState(
    queryParams.get("description") || "",
  );
  const [tags, setTags] = useState("");
  const [numQuestions, setNumQuestions] = useState(5);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [quizId, setQuizId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCourse = async () => {
      try {
        const res = await api.get(`/courses/${id}`, {
          headers: token ? { "x-auth-token": token } : undefined,
        });
        setTopic((prev) => prev || res.data?.title || "");
        setDescription((prev) => prev || res.data?.description || "");
      } catch (err) {
        console.error(err);
        setError("Unable to load course details.");
      } finally {
        setLoading(false);
      }
    };
    if (id) {
      fetchCourse();
    }
  }, [id, token]);

  useEffect(() => {
    setTargetLessonId(lessonId);
  }, [lessonId]);

  useEffect(() => {
    if (!id) return;
    if (typeof window === "undefined") return;
    const mode = queryParams.get("mode");
    if (mode !== "edit") return;
    const raw = window.localStorage.getItem(`edit-quiz:${id}`);
    if (!raw) return;

    try {
      const payload = JSON.parse(raw) as { lessonId: string; quiz: QuizPayload };
      if (payload.lessonId) {
        setTargetLessonId(payload.lessonId);
      }
      if (payload.quiz) {
        setTopic(payload.quiz.title || "");
        setDescription(payload.quiz.description || "");
        setTags((payload.quiz.tags || []).join(", "));
        setQuestions(Array.isArray(payload.quiz.questions) ? payload.quiz.questions : []);
        setQuizId(payload.quiz.id || null);
        if (payload.quiz.questions?.length) {
          setNumQuestions(payload.quiz.questions.length);
        }
      }
    } catch (err) {
      console.error("Failed to load quiz for editing", err);
    } finally {
      window.localStorage.removeItem(`edit-quiz:${id}`);
    }
  }, [id, queryParams]);

  const tagList = useMemo(
    () =>
      tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
    [tags],
  );

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!topic.trim() || !description.trim()) {
      setError("Please provide a topic and description.");
      return;
    }

    setGenerating(true);
    try {
      const res = await api.post(
        "/courses/generate-quiz",
        {
          topic: topic.trim(),
          description: description.trim(),
          tags: tagList,
          numQuestions,
        },
        { headers: { "x-auth-token": token } },
      );

      const received = Array.isArray(res.data.questions) ? res.data.questions : [];
      setQuestions(received);
    } catch (err: any) {
      console.error(err);
      const message =
        err?.response?.data?.msg ||
        err?.response?.data?.error ||
        "Failed to generate quiz. Please try again.";
      setError(message);
    } finally {
      setGenerating(false);
    }
  };

  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      { question: "", options: ["", "", "", ""], correct: 0 },
    ]);
  };

  const updateQuestion = (index: number, updates: Partial<QuizQuestion>) => {
    setQuestions((prev) =>
      prev.map((question, qIndex) =>
        qIndex === index ? { ...question, ...updates } : question,
      ),
    );
  };

  const updateOption = (
    index: number,
    optionIndex: number,
    value: string,
  ) => {
    setQuestions((prev) =>
      prev.map((question, qIndex) => {
        if (qIndex !== index) return question;
        const nextOptions = question.options.length
          ? [...question.options]
          : ["", "", "", ""];
        nextOptions[optionIndex] = value;
        return { ...question, options: nextOptions };
      }),
    );
  };

  const removeQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, qIndex) => qIndex !== index));
  };

  const handleSaveQuiz = () => {
    if (!id) return;
    if (!targetLessonId) {
      setError("Select a lesson to attach this quiz.");
      return;
    }
    if (!topic.trim() || !description.trim()) {
      setError("Please provide a quiz title and description.");
      return;
    }
    if (!questions.length) {
      setError("Generate or add at least one question.");
      return;
    }

    setSaving(true);
    setError(null);

    const nextQuizId = quizId?.trim() ? quizId : createId();
    const payload = {
      lessonId: targetLessonId,
      quiz: {
        id: nextQuizId,
        title: topic.trim(),
        description: description.trim(),
        tags: tagList,
        questions,
      },
    };
    setQuizId(nextQuizId);

    try {
      window.localStorage.setItem(
        `pending-quiz:${id}`,
        JSON.stringify(payload),
      );
      navigate(returnTo);
    } catch (err: any) {
      console.error(err);
      setError("Failed to save the quiz. Please try again.");
    } finally {
      setSaving(false);
    }
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
            <Link to={returnTo} className="text-xs uppercase text-emerald-600">
              Back to lesson editor
            </Link>
            <h1 className="text-3xl md:text-4xl font-semibold text-slate-900 mt-2">
              Build a quiz
            </h1>
            <p className="text-sm text-slate-600 mt-2 max-w-2xl">
              Define the quiz and refine the questions before inserting it into
              your lesson.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSaveQuiz}
              disabled={saving || questions.length === 0}
              className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save quiz"}
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-8 items-start">
          <form
            onSubmit={handleGenerate}
            className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-soft space-y-5"
          >
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Quiz brief
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Keep it specific so the AI can focus on the right concepts.
              </p>
            </div>

            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Topic
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                placeholder="Foundations of DeFi lending"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                rows={5}
                placeholder="What should learners understand after this quiz?"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Tags
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                placeholder="lending, collateral, risk"
              />
              <p className="text-xs text-slate-500 mt-2">
                Separate tags with commas. Optional but helpful.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Number of questions
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={numQuestions}
                onChange={(e) => setNumQuestions(Number(e.target.value))}
                className="w-full mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
            </div>

            <button
              type="submit"
              disabled={generating}
              className="w-full rounded-full border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition disabled:opacity-60"
            >
              {generating ? "Generating..." : "Generate quiz questions"}
            </button>
          </form>

          <section className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-soft space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-slate-400">Questions</p>
                <h2 className="text-lg font-semibold text-slate-900 mt-1">
                  Review and edit
                </h2>
              </div>
              <button
                type="button"
                onClick={addQuestion}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 transition"
              >
                + Add question
              </button>
            </div>

            {questions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                Generate a quiz to draft questions here.
              </div>
            ) : (
              <div className="space-y-5">
                {questions.map((q, index) => (
                  <div
                    key={`${index}-${q.question}`}
                    className="rounded-2xl border border-slate-100 bg-white p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase text-slate-400">
                        Question {index + 1}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeQuestion(index)}
                        className="text-xs font-semibold uppercase text-rose-500"
                      >
                        Remove
                      </button>
                    </div>
                    <input
                      value={q.question}
                      onChange={(event) =>
                        updateQuestion(index, { question: event.target.value })
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                      placeholder="Enter the question"
                    />
                    <div className="space-y-2">
                      {(q.options.length ? q.options : ["", "", "", ""]).map(
                        (option, optionIndex) => (
                          <div
                            key={`${index}-${optionIndex}`}
                            className="flex items-center gap-3"
                          >
                            <input
                              type="radio"
                              name={`correct-${index}`}
                              checked={q.correct === optionIndex}
                              onChange={() =>
                                updateQuestion(index, { correct: optionIndex })
                              }
                            />
                            <input
                              value={option}
                              onChange={(event) =>
                                updateOption(index, optionIndex, event.target.value)
                              }
                              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                              placeholder={`Option ${optionIndex + 1}`}
                            />
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default GenerateQuiz;
