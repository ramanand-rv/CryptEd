/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import type { JSONContent } from "@tiptap/react";
import Editor from "../components/Editor";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

const defaultContent: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

const CourseLessonEditor: React.FC = () => {
  const { id, lessonId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonDescription, setLessonDescription] = useState("");
  const [content, setContent] = useState<JSONContent>(defaultContent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<any[]>([]);

  useEffect(() => {
    const fetchLesson = async () => {
      try {
        const res = await api.get(`/courses/${id}`, {
          headers: token ? { "x-auth-token": token } : undefined,
        });
        const course = res.data;
        const courseBlocks = Array.isArray(course?.content)
          ? course.content
          : Array.isArray(course?.content?.content)
            ? course.content.content
            : [];

        const lessonIndex = courseBlocks.findIndex(
          (block: any) =>
            block?.type === "lesson" && block?.attrs?.lessonId === lessonId,
        );

        if (lessonIndex === -1) {
          setError("Lesson not found.");
          setBlocks(courseBlocks);
          return;
        }

        const lessonBlock = courseBlocks[lessonIndex];
        setLessonTitle(lessonBlock?.attrs?.title || "Untitled lesson");
        setLessonDescription(lessonBlock?.attrs?.description || "");
        setContent(lessonBlock?.attrs?.content || defaultContent);
        setBlocks(courseBlocks);
      } catch (err) {
        console.error(err);
        setError("Unable to load lesson content.");
      } finally {
        setLoading(false);
      }
    };

    if (id && lessonId) {
      fetchLesson();
    }
  }, [id, lessonId, token]);

  useEffect(() => {
    if (!id || !lessonId) return;
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(`pending-quiz:${id}`);
    if (!raw) return;

    try {
      const pending = JSON.parse(raw) as {
        lessonId: string;
        quiz: {
          title: string;
          description: string;
          tags: string[];
          questions: any[];
        };
      };
      if (pending.lessonId !== lessonId) return;
      setContent((prev) => ({
        ...prev,
        content: [
          ...(Array.isArray(prev.content) ? prev.content : []),
          { type: "quiz", attrs: pending.quiz },
        ],
      }));
      window.localStorage.removeItem(`pending-quiz:${id}`);
    } catch (err) {
      console.error("Failed to apply pending quiz", err);
    }
  }, [id, lessonId]);

  const openQuizBuilder = () => {
    if (!id || !lessonId) return;
    const params = new URLSearchParams({
      lessonId,
      returnTo: `${location.pathname}${location.search}`,
      topic: lessonTitle || "",
      description: lessonDescription || "",
    });
    navigate(`/courses/${id}/quiz?${params.toString()}`);
  };

  const handleSave = async () => {
    if (!id || !lessonId) return;
    setSaving(true);
    setError(null);

    const nextBlocks = [...blocks];
    const lessonIndex = nextBlocks.findIndex(
      (block: any) =>
        block?.type === "lesson" && block?.attrs?.lessonId === lessonId,
    );

    if (lessonIndex === -1) {
      setError("Lesson not found.");
      setSaving(false);
      return;
    }

    const existing = nextBlocks[lessonIndex];
    nextBlocks[lessonIndex] = {
      ...existing,
      attrs: {
        ...existing.attrs,
        title: lessonTitle.trim() || "Untitled lesson",
        description: lessonDescription.trim(),
        content,
      },
    };

    try {
      await api.put(
        `/courses/${id}`,
        { content: nextBlocks },
        { headers: { "x-auth-token": token } },
      );
      navigate(`/courses/${id}/contents`);
    } catch (err: any) {
      console.error(err);
      const message =
        err?.response?.data?.msg ||
        err?.response?.data?.error ||
        "Failed to save lesson content.";
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
            <Link
              to={`/courses/${id}/contents`}
              className="text-xs uppercase text-emerald-600"
            >
              Back to course contents
            </Link>
            <h1 className="text-3xl md:text-4xl font-semibold text-slate-900 mt-2">
              Lesson editor
            </h1>
            <p className="text-sm text-slate-600 mt-2 max-w-2xl">
              Write lesson content, add media links, and refine the narrative.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save lesson"}
          </button>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-8 items-start">
          <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-soft space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Lesson title
              </label>
              <input
                type="text"
                value={lessonTitle}
                onChange={(e) => setLessonTitle(e.target.value)}
                className="w-full mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Lesson description
              </label>
              <textarea
                value={lessonDescription}
                onChange={(e) => setLessonDescription(e.target.value)}
                className="w-full mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                rows={4}
              />
            </div>
          </div>

          <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-soft space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Lesson content
              </h2>
              <p className="text-xs text-slate-500">
                Use the editor to add text, images, video links, and structure.
              </p>
            </div>
            <Editor
              content={content}
              onChange={setContent}
              onAddQuiz={openQuizBuilder}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseLessonEditor;
