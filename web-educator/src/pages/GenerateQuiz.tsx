import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
}

const GenerateQuiz: React.FC = () => {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<any>(null);
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [numQuestions, setNumQuestions] = useState(5);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCourse = async () => {
      try {
        const res = await api.get(`/courses/${id}`, {
          headers: token ? { "x-auth-token": token } : undefined,
        });
        setCourse(res.data);
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

  const handleAddToCourse = async () => {
    if (!id) return;
    if (!course) {
      setError("Course details are missing. Please reload the page.");
      return;
    }
    if (!questions.length) {
      setError("Generate a quiz before adding it to the course.");
      return;
    }

    setSaving(true);
    setError(null);

    const quizBlock = {
      type: "quiz",
      attrs: {
        topic: topic.trim(),
        description: description.trim(),
        tags: tagList,
        questions,
      },
    };

    const existingContent = course?.content;
    const updatedContent = Array.isArray(existingContent)
      ? [...existingContent, quizBlock]
      : existingContent && Array.isArray(existingContent.content)
        ? { ...existingContent, content: [...existingContent.content, quizBlock] }
        : [quizBlock];

    try {
      await api.put(
        `/courses/${id}`,
        { content: updatedContent },
        { headers: { "x-auth-token": token } },
      );
      navigate(`/courses/${id}`);
    } catch (err: any) {
      console.error(err);
      const message =
        err?.response?.data?.msg ||
        err?.response?.data?.error ||
        "Failed to add quiz to course.";
      setError(message);
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
            <Link to={`/courses/${id}`} className="text-xs uppercase text-emerald-600">
              Back to course dashboard
            </Link>
            <h1 className="text-3xl md:text-4xl font-semibold text-slate-900 mt-2">
              Generate an AI quiz
            </h1>
            <p className="text-sm text-slate-600 mt-2 max-w-2xl">
              Define the topic, learning focus, and tags. We will draft a quiz you
              can review before adding to the course.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleAddToCourse}
              disabled={saving || questions.length === 0 || !course}
              className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-60"
            >
              {saving ? "Adding..." : "Add quiz to course"}
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
                <p className="text-xs uppercase text-slate-400">Preview</p>
                <h2 className="text-lg font-semibold text-slate-900 mt-1">
                  Review the quiz
                </h2>
              </div>
              {questions.length > 0 && (
                <span className="text-sm text-emerald-700">
                  {questions.length} questions
                </span>
              )}
            </div>

            {questions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                Generate a quiz to preview the questions here.
              </div>
            ) : (
              <div className="space-y-5">
                {questions.map((q, index) => (
                  <div
                    key={`${q.question}-${index}`}
                    className="rounded-2xl border border-slate-100 bg-white p-4"
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {index + 1}. {q.question}
                    </p>
                    <div className="mt-3 space-y-2">
                      {q.options.map((option, optionIndex) => (
                        <div
                          key={`${option}-${optionIndex}`}
                          className={`rounded-xl border px-3 py-2 text-sm ${
                            optionIndex === q.correct
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-100 text-slate-600"
                          }`}
                        >
                          {option}
                        </div>
                      ))}
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
