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

interface QuizPayload {
  id?: string;
  title: string;
  description: string;
  tags: string[];
  questions: any[];
}

interface DiscussionAuthor {
  id: string;
  name: string;
  role: "educator" | "learner";
}

interface DiscussionReply {
  _id: string;
  message: string;
  author: DiscussionAuthor;
  createdAt: string;
}

interface DiscussionThread {
  _id: string;
  lessonId: string;
  question: string;
  askedBy: DiscussionAuthor;
  replies: DiscussionReply[];
  createdAt: string;
}

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const formatDateTime = (value?: string) => {
  if (!value) return "Unknown time";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown time";
  return parsed.toLocaleString();
};

const pendingQuizKey = (courseId: string) => `pending-quiz:${courseId}`;
const editingQuizKey = (courseId: string) => `edit-quiz:${courseId}`;

const upsertQuizBlock = (content: JSONContent, quiz: QuizPayload): JSONContent => {
  const existingBlocks = Array.isArray(content.content) ? content.content : [];
  const quizId = quiz.id?.trim() ? quiz.id : createId();
  let replaced = false;

  const nextBlocks = existingBlocks.map((block: any) => {
    if (block?.type === "quiz" && block?.attrs?.id === quizId) {
      replaced = true;
      return { ...block, attrs: { ...quiz, id: quizId } };
    }
    return block;
  });

  if (!replaced) {
    nextBlocks.push({ type: "quiz", attrs: { ...quiz, id: quizId } });
  }

  return {
    ...content,
    content: nextBlocks,
  };
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
  const [discussionLoading, setDiscussionLoading] = useState(false);
  const [discussionError, setDiscussionError] = useState<string | null>(null);
  const [discussionThreads, setDiscussionThreads] = useState<DiscussionThread[]>(
    [],
  );
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyingThreadId, setReplyingThreadId] = useState<string | null>(null);

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
    const raw = window.localStorage.getItem(pendingQuizKey(id));
    if (!raw) return;

    try {
      const pending = JSON.parse(raw) as { lessonId: string; quiz: QuizPayload };
      if (pending.lessonId !== lessonId) return;
      setContent((prev) => upsertQuizBlock(prev, pending.quiz));
      window.localStorage.removeItem(pendingQuizKey(id));
    } catch (err) {
      console.error("Failed to apply pending quiz", err);
    }
  }, [id, lessonId]);

  useEffect(() => {
    const fetchLessonDiscussions = async () => {
      if (!id || !lessonId || !token) return;
      setDiscussionLoading(true);
      setDiscussionError(null);

      try {
        const res = await api.get(
          `/courses/${id}/lessons/${encodeURIComponent(lessonId)}/discussions`,
          {
            headers: { "x-auth-token": token },
          },
        );
        const nextThreads = Array.isArray(res.data?.discussions)
          ? (res.data.discussions as DiscussionThread[])
          : [];
        setDiscussionThreads(nextThreads);
      } catch (err: any) {
        console.error(err);
        const message =
          err?.response?.data?.msg ||
          err?.response?.data?.error ||
          "Unable to load lesson discussions.";
        setDiscussionError(message);
        setDiscussionThreads([]);
      } finally {
        setDiscussionLoading(false);
      }
    };

    fetchLessonDiscussions();
  }, [id, lessonId, token]);

  const openQuizBuilder = (quiz?: QuizPayload) => {
    if (!id || !lessonId) return;
    if (typeof window !== "undefined") {
      if (quiz) {
        window.localStorage.setItem(
          editingQuizKey(id),
          JSON.stringify({ lessonId, quiz }),
        );
      } else {
        window.localStorage.removeItem(editingQuizKey(id));
      }
    }
    const params = new URLSearchParams({
      lessonId,
      returnTo: `${location.pathname}${location.search}`,
      topic: lessonTitle || "",
      description: lessonDescription || "",
    });
    if (quiz) {
      params.set("mode", "edit");
    }
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

  const handleReply = async (threadId: string) => {
    if (!id || !lessonId || !token) return;
    const message = (replyDrafts[threadId] || "").trim();
    if (!message) return;

    setReplyingThreadId(threadId);
    setDiscussionError(null);
    try {
      const res = await api.post(
        `/courses/${id}/lessons/${encodeURIComponent(lessonId)}/discussions/${threadId}/replies`,
        { message },
        { headers: { "x-auth-token": token } },
      );
      const updatedDiscussion = res.data?.discussion as
        | DiscussionThread
        | undefined;
      if (updatedDiscussion?._id) {
        setDiscussionThreads((prev) =>
          prev.map((thread) =>
            thread._id === updatedDiscussion._id ? updatedDiscussion : thread,
          ),
        );
      }
      setReplyDrafts((prev) => ({ ...prev, [threadId]: "" }));
    } catch (err: any) {
      console.error(err);
      const messageText =
        err?.response?.data?.msg ||
        err?.response?.data?.error ||
        "Failed to post reply.";
      setDiscussionError(messageText);
    } finally {
      setReplyingThreadId(null);
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
              onAddQuiz={() => openQuizBuilder()}
              onEditQuiz={(quiz) => openQuizBuilder(quiz)}
            />
          </div>
        </div>

        <section className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-soft space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Lesson discussion
              </h2>
              <p className="text-xs text-slate-500">
                Reply to learner questions for this lesson.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!id || !lessonId || !token) return;
                setDiscussionLoading(true);
                setDiscussionError(null);
                api
                  .get(
                    `/courses/${id}/lessons/${encodeURIComponent(lessonId)}/discussions`,
                    {
                      headers: { "x-auth-token": token },
                    },
                  )
                  .then((res) => {
                    const nextThreads = Array.isArray(res.data?.discussions)
                      ? (res.data.discussions as DiscussionThread[])
                      : [];
                    setDiscussionThreads(nextThreads);
                  })
                  .catch((err: any) => {
                    const message =
                      err?.response?.data?.msg ||
                      err?.response?.data?.error ||
                      "Unable to refresh lesson discussions.";
                    setDiscussionError(message);
                  })
                  .finally(() => setDiscussionLoading(false));
              }}
              disabled={discussionLoading}
              className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300 transition disabled:opacity-60"
            >
              {discussionLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {discussionError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {discussionError}
            </div>
          )}

          {!discussionLoading && discussionThreads.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500 text-center">
              No learner questions yet for this lesson.
            </div>
          )}

          <div className="space-y-4">
            {discussionThreads.map((thread) => (
              <article
                key={thread._id}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <p className="text-xs text-slate-500">
                  {thread.askedBy?.name || "Learner"} •{" "}
                  {formatDateTime(thread.createdAt)}
                </p>
                <p className="text-sm text-slate-900 font-medium mt-2">
                  {thread.question}
                </p>

                <div className="mt-3 space-y-3">
                  {thread.replies.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No replies yet. Add guidance for the learner.
                    </p>
                  ) : (
                    thread.replies.map((reply) => (
                      <div
                        key={reply._id}
                        className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2"
                      >
                        <p className="text-xs text-emerald-700">
                          {reply.author?.name || "Educator"} •{" "}
                          {formatDateTime(reply.createdAt)}
                        </p>
                        <p className="text-sm text-slate-700 mt-1">
                          {reply.message}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-4 space-y-2">
                  <textarea
                    value={replyDrafts[thread._id] || ""}
                    onChange={(e) =>
                      setReplyDrafts((prev) => ({
                        ...prev,
                        [thread._id]: e.target.value,
                      }))
                    }
                    rows={3}
                    placeholder="Write a helpful reply..."
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                  <button
                    type="button"
                    onClick={() => handleReply(thread._id)}
                    disabled={
                      replyingThreadId === thread._id ||
                      !(replyDrafts[thread._id] || "").trim()
                    }
                    className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-60"
                  >
                    {replyingThreadId === thread._id ? "Sending..." : "Reply"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default CourseLessonEditor;
