import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import type { JSONContent } from "@tiptap/react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import LessonBasics from "./course-contents/LessonBasics";
import LessonRow from "./course-contents/LessonRow";
import ContentLessonEditor from "./course-contents/ContentLessonEditor";
import type {
  Lesson,
  PendingQuiz,
  QuizPayload,
  StoredState,
} from "./course-contents/types";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

const DEFAULT_CONTENT: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

const SIDEBAR_MIN = 260;
const SIDEBAR_MAX = 420;
const SIDEBAR_COLLAPSED = 72;

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const storageKey = (courseId: string) => `course-contents:${courseId}`;
const pendingQuizKey = (courseId: string) => `pending-quiz:${courseId}`;
const editingQuizKey = (courseId: string) => `edit-quiz:${courseId}`;

const loadStoredState = (courseId: string): StoredState | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(courseId));
    if (!raw) return null;
    return JSON.parse(raw) as StoredState;
  } catch (err) {
    console.error("Failed to parse stored course contents", err);
    return null;
  }
};

const saveStoredState = (courseId: string, state: StoredState) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(courseId), JSON.stringify(state));
};

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

interface CommentAuthor {
  id: string;
  name: string;
  role: "educator" | "learner";
}

interface CommentNode {
  _id: string;
  courseId: string;
  blockIndex: number;
  parentId: string | null;
  text: string;
  author: CommentAuthor;
  createdAt: string;
  updatedAt: string;
  replies: CommentNode[];
}

const addReplyToTree = (
  tree: CommentNode[],
  parentId: string,
  comment: CommentNode,
): CommentNode[] => {
  return tree.map((node) => {
    if (node._id === parentId) {
      return { ...node, replies: [...(node.replies || []), comment] };
    }
    if (!node.replies?.length) return node;
    return {
      ...node,
      replies: addReplyToTree(node.replies, parentId, comment),
    };
  });
};

const CourseContents: React.FC = () => {
  const { id } = useParams();
  const { token, user } = useAuth();
  const { connected, publicKey } = useWallet();
  const navigate = useNavigate();
  const location = useLocation();

  const containerRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadStatus, setLoadStatus] = useState<
    "loading" | "server" | "local" | "error"
  >("loading");
  const [courseTitle, setCourseTitle] = useState("");
  const [courseStatus, setCourseStatus] = useState<"draft" | "published">(
    "draft",
  );
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [legacyBlocks, setLegacyBlocks] = useState<any[]>([]);
  const [hasLegacy, setHasLegacy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [collapsedLessonIds, setCollapsedLessonIds] = useState<Set<string>>(
    new Set(),
  );
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [comments, setComments] = useState<CommentNode[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [activeReplyParentId, setActiveReplyParentId] = useState<string | null>(
    null,
  );
  const [postingReplyFor, setPostingReplyFor] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const canSync = loadStatus === "server";
  const savedWalletAddress = user?.walletAddress || "";
  const connectedWalletAddress = publicKey?.toBase58() || "";
  const isWalletConnectedAndVerified =
    Boolean(user?.walletVerifiedAt) &&
    Boolean(savedWalletAddress) &&
    connected &&
    connectedWalletAddress === savedWalletAddress;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  useEffect(() => {
    const fetchCourse = async () => {
      if (!id) return;
      setLoadStatus("loading");
      try {
        const res = await api.get(`/courses/${id}`, {
          headers: token ? { "x-auth-token": token } : undefined,
        });
        const course = res.data;
        setCourseTitle(course?.title || "Course");
        setCourseStatus(course?.status === "draft" ? "draft" : "published");

        const blocks = Array.isArray(course?.content)
          ? course.content
          : Array.isArray(course?.content?.content)
            ? course.content.content
            : [];

        const parsedLessons: Lesson[] = [];
        const extras: any[] = [];
        let legacyDetected = false;

        blocks.forEach((block: any) => {
          if (block?.type === "lesson") {
            const lessonId = block?.attrs?.lessonId || createId();
            parsedLessons.push({
              id: lessonId,
              title: block?.attrs?.title || "Untitled lesson",
              description: block?.attrs?.description || "",
              content: block?.attrs?.content || DEFAULT_CONTENT,
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
            content: DEFAULT_CONTENT,
          });
        }

        const stored = loadStoredState(id);
        if (stored?.lessons?.length) {
          const normalizedLessons = stored.lessons.map((lesson) => ({
            ...lesson,
            description: lesson.description || "",
            content: lesson.content || DEFAULT_CONTENT,
          }));
          setLessons(normalizedLessons);
          setCollapsedLessonIds(new Set(stored.collapsedLessonIds || []));
          const storedWidth = stored.sidebarWidth || 320;
          const clampedWidth = Math.min(
            Math.max(storedWidth, SIDEBAR_MIN),
            SIDEBAR_MAX,
          );
          setSidebarWidth(clampedWidth);
          setSidebarCollapsed(Boolean(stored.sidebarCollapsed));
          setSelectedLessonId(
            stored.selectedLessonId || normalizedLessons[0]?.id || null,
          );
        } else {
          setLessons(parsedLessons);
          setSelectedLessonId(parsedLessons[0]?.id || null);
        }

        setLegacyBlocks(extras);
        setHasLegacy(legacyDetected);
        setError(null);
        setLoadStatus("server");
        setHydrated(true);
      } catch (err) {
        console.error(err);
        const stored = loadStoredState(id);
        if (stored?.lessons?.length) {
          const normalizedLessons = stored.lessons.map((lesson) => ({
            ...lesson,
            description: lesson.description || "",
            content: lesson.content || DEFAULT_CONTENT,
          }));
          setLessons(normalizedLessons);
          setCollapsedLessonIds(new Set(stored.collapsedLessonIds || []));
          const storedWidth = stored.sidebarWidth || 320;
          const clampedWidth = Math.min(
            Math.max(storedWidth, SIDEBAR_MIN),
            SIDEBAR_MAX,
          );
          setSidebarWidth(clampedWidth);
          setSidebarCollapsed(Boolean(stored.sidebarCollapsed));
          setSelectedLessonId(
            stored.selectedLessonId || normalizedLessons[0]?.id || null,
          );
          setLoadStatus("local");
          setHydrated(true);
          setError("Offline: loaded your local draft. Sync is disabled.");
        } else {
          setLoadStatus("error");
          setHydrated(false);
          setError("Unable to load course contents. Please check your connection.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchCourse();
  }, [id, token]);

  useEffect(() => {
    if (!id || !hydrated) return;

    setAutoSaveStatus("saving");
    const handle = window.setTimeout(() => {
      const state: StoredState = {
        lessons,
        collapsedLessonIds: Array.from(collapsedLessonIds),
        sidebarWidth,
        sidebarCollapsed,
        selectedLessonId,
      };
      saveStoredState(id, state);
      setAutoSaveStatus("saved");
    }, 600);

    return () => window.clearTimeout(handle);
  }, [
    id,
    lessons,
    collapsedLessonIds,
    sidebarWidth,
    sidebarCollapsed,
    selectedLessonId,
    hydrated,
  ]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMove = (event: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const nextWidth = event.clientX - rect.left;
      const clamped = Math.min(Math.max(nextWidth, SIDEBAR_MIN), SIDEBAR_MAX);
      setSidebarWidth(clamped);
    };

    const handleUp = () => setIsResizing(false);

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isResizing]);

  const activeLesson = useMemo(
    () => lessons.find((lesson) => lesson.id === selectedLessonId) || lessons[0],
    [lessons, selectedLessonId],
  );
  const activeBlockIndex = useMemo(() => {
    if (!activeLesson) return -1;
    return lessons.findIndex((lesson) => lesson.id === activeLesson.id);
  }, [lessons, activeLesson]);

  const lessonIds = useMemo(() => lessons.map((lesson) => lesson.id), [lessons]);


  useEffect(() => {
    if (!lessons.length) return;
    if (selectedLessonId && lessons.some((lesson) => lesson.id === selectedLessonId)) {
      return;
    }
    setSelectedLessonId(lessons[0].id);
  }, [lessons, selectedLessonId]);

  useEffect(() => {
    if (!id || lessons.length === 0) return;
    if (typeof window === "undefined") return;

    const raw = window.localStorage.getItem(pendingQuizKey(id));
    if (!raw) return;

    try {
      const pending = JSON.parse(raw) as PendingQuiz;
      const targetId = pending.lessonId || selectedLessonId;
      const targetLesson = lessons.find((lesson) => lesson.id === targetId);
      if (!targetLesson) return;

      updateLesson(targetLesson.id, {
        content: upsertQuizBlock(targetLesson.content, pending.quiz),
      });
      window.localStorage.removeItem(pendingQuizKey(id));
    } catch (err) {
      console.error("Failed to apply pending quiz", err);
    }
  }, [id, lessons, selectedLessonId]);

  const updateLesson = (lessonId: string, updates: Partial<Lesson>) => {
    setLessons((prev) =>
      prev.map((lesson) =>
        lesson.id === lessonId ? { ...lesson, ...updates } : lesson,
      ),
    );
  };

  const addLesson = (afterId?: string) => {
    const newLesson: Lesson = {
      id: createId(),
      title: "New lesson",
      description: "",
      content: DEFAULT_CONTENT,
    };
    setLessons((prev) => {
      if (!afterId) return [...prev, newLesson];
      const index = prev.findIndex((lesson) => lesson.id === afterId);
      if (index === -1) return [...prev, newLesson];
      const next = [...prev];
      next.splice(index + 1, 0, newLesson);
      return next;
    });
    setSelectedLessonId(newLesson.id);
    setEditingLessonId(newLesson.id);
    setEditingTitle(newLesson.title);
  };

  const openQuizBuilder = (lesson: Lesson, quiz?: QuizPayload) => {
    if (!id) return;
    if (typeof window !== "undefined") {
      if (quiz) {
        window.localStorage.setItem(
          editingQuizKey(id),
          JSON.stringify({ lessonId: lesson.id, quiz }),
        );
      } else {
        window.localStorage.removeItem(editingQuizKey(id));
      }
    }
    const params = new URLSearchParams({
      lessonId: lesson.id,
      returnTo: `${location.pathname}${location.search}`,
      topic: lesson.title || "",
      description: lesson.description || "",
    });
    if (quiz) {
      params.set("mode", "edit");
    }
    navigate(`/courses/${id}/quiz?${params.toString()}`);
  };

  const removeLesson = (lessonId: string) => {
    setLessons((prev) => prev.filter((lesson) => lesson.id !== lessonId));
    setCollapsedLessonIds((prev) => {
      const next = new Set(prev);
      next.delete(lessonId);
      return next;
    });
  };

  const toggleLessonCollapse = (lessonId: string) => {
    setCollapsedLessonIds((prev) => {
      const next = new Set(prev);
      if (next.has(lessonId)) {
        next.delete(lessonId);
      } else {
        next.add(lessonId);
      }
      return next;
    });
  };

  const startRename = (lesson: Lesson) => {
    setEditingLessonId(lesson.id);
    setEditingTitle(lesson.title);
  };

  const commitRename = () => {
    if (!editingLessonId) return;
    updateLesson(editingLessonId, {
      title: editingTitle.trim() || "Untitled lesson",
    });
    setEditingLessonId(null);
    setEditingTitle("");
  };

  const handleDragStart = (event: any) => {
    const nextId = event.active?.id || null;
    setActiveDragId(nextId);
    if (nextId) setSelectedLessonId(nextId);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over || active.id === over.id) return;

    setLessons((prev) => {
      const oldIndex = prev.findIndex((lesson) => lesson.id === active.id);
      const newIndex = prev.findIndex((lesson) => lesson.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const handleDragCancel = () => setActiveDragId(null);

  const handleSyncToCourse = async () => {
    if (!id) return;
    if (!canSync) {
      setError("Offline: reconnect and refresh before syncing to the server.");
      return;
    }
    setIsSyncing(true);
    setError(null);

    const flattened = lessons.map((lesson) => ({
      type: "lesson",
      attrs: {
        lessonId: lesson.id,
        title: lesson.title.trim() || "Untitled lesson",
        description: lesson.description.trim(),
        content: lesson.content,
      },
    }));

    const nextContent = hasLegacy ? [...flattened, ...legacyBlocks] : flattened;

    try {
      await api.put(
        `/courses/${id}`,
        { content: nextContent },
        { headers: { "x-auth-token": token } },
      );
    } catch (err: any) {
      console.error(err);
      const message =
        err?.response?.data?.msg ||
        err?.response?.data?.error ||
        "Failed to save course contents.";
      setError(message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePublishCourse = async () => {
    if (!id || courseStatus === "published") return;
    if (!canSync) {
      setError("Offline: reconnect and refresh before publishing.");
      return;
    }
    if (!isWalletConnectedAndVerified) {
      setError("Connect your verified wallet before publishing this draft.");
      return;
    }
    setIsSyncing(true);
    setError(null);

    try {
      await api.put(
        `/courses/${id}`,
        { status: "published" },
        {
          headers: {
            "x-auth-token": token,
            "x-wallet-address": connectedWalletAddress,
          },
        },
      );
      setCourseStatus("published");
    } catch (err: any) {
      console.error(err);
      const message =
        err?.response?.data?.msg ||
        err?.response?.data?.error ||
        "Failed to publish course.";
      setError(message);
    } finally {
      setIsSyncing(false);
    }
  };

  const fetchComments = async () => {
    if (!id || !token || activeBlockIndex < 0) return;
    setCommentsLoading(true);
    setCommentsError(null);
    try {
      const res = await api.get(`/courses/${id}/comments`, {
        headers: { "x-auth-token": token },
        params: { blockIndex: activeBlockIndex },
      });
      const nextComments = Array.isArray(res.data?.comments)
        ? (res.data.comments as CommentNode[])
        : [];
      setComments(nextComments);
    } catch (err: any) {
      const message =
        err?.response?.data?.msg ||
        err?.response?.data?.error ||
        "Unable to load comments for this lesson.";
      setCommentsError(message);
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handlePostComment = async (parentId?: string) => {
    if (!id || !token || activeBlockIndex < 0) return;
    const draft = parentId
      ? (replyDrafts[parentId] || "").trim()
      : newCommentText.trim();
    if (!draft) return;

    if (parentId) {
      setPostingReplyFor(parentId);
    } else {
      setPostingComment(true);
    }

    try {
      const res = await api.post(
        `/courses/${id}/comments`,
        {
          blockIndex: activeBlockIndex,
          text: draft,
          ...(parentId ? { parentId } : {}),
        },
        { headers: { "x-auth-token": token } },
      );
      const created = res.data?.comment as CommentNode | undefined;
      if (created?._id) {
        if (created.parentId) {
          setComments((prev) => addReplyToTree(prev, created.parentId!, created));
        } else {
          setComments((prev) => [...prev, created]);
        }
      }

      if (parentId) {
        setReplyDrafts((prev) => ({ ...prev, [parentId]: "" }));
        setActiveReplyParentId(null);
      } else {
        setNewCommentText("");
      }
    } catch (err: any) {
      const message =
        err?.response?.data?.msg ||
        err?.response?.data?.error ||
        "Unable to post comment.";
      setCommentsError(message);
    } finally {
      if (parentId) {
        setPostingReplyFor(null);
      } else {
        setPostingComment(false);
      }
    }
  };

  useEffect(() => {
    fetchComments();
  }, [id, token, activeBlockIndex]);

  const renderComment = (comment: CommentNode, depth = 0): React.ReactNode => {
    const isReplying = activeReplyParentId === comment._id;
    return (
      <div
        key={comment._id}
        className={`rounded-2xl border border-slate-100 bg-white p-4 ${
          depth > 0 ? "ml-4 mt-3" : "mt-3"
        }`}
      >
        <p className="text-xs text-slate-500">
          <span className="font-semibold text-slate-700">
            {comment.author?.name || "User"}
          </span>{" "}
          • {new Date(comment.createdAt).toLocaleString()}
        </p>
        <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">
          {comment.text}
        </p>
        <button
          type="button"
          onClick={() =>
            setActiveReplyParentId((prev) =>
              prev === comment._id ? null : comment._id,
            )
          }
          className="mt-2 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
        >
          {isReplying ? "Cancel" : "Reply"}
        </button>
        {isReplying && (
          <div className="mt-3 space-y-2">
            <textarea
              value={replyDrafts[comment._id] || ""}
              onChange={(event) =>
                setReplyDrafts((prev) => ({
                  ...prev,
                  [comment._id]: event.target.value,
                }))
              }
              rows={2}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              placeholder="Write a reply..."
            />
            <button
              type="button"
              disabled={postingReplyFor === comment._id}
              onClick={() => handlePostComment(comment._id)}
              className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {postingReplyFor === comment._id ? "Posting..." : "Post reply"}
            </button>
          </div>
        )}

        {(comment.replies || []).map((reply) => renderComment(reply, depth + 1))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 flex flex-col">
      <div className="flex-1 min-h-0 max-w-350 mx-auto px-4 md:px-8 py-8 flex flex-col gap-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <Link
              to={`/courses/${id}`}
              className="text-xs uppercase text-emerald-600"
            >
              Back to course dashboard
            </Link>
            <div className="flex items-center gap-3 mt-2">
              <h1 className="text-3xl md:text-4xl font-semibold text-slate-900">
                Course contents
              </h1>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                  courseStatus === "published"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {courseStatus === "published" ? "Published" : "Draft"}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-2 max-w-2xl">
              Organize lessons and content for {courseTitle}. Changes auto-save
              locally.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
            >
              Lessons
            </button>
            <div className="text-xs text-slate-400">
              {autoSaveStatus === "saving" && "Saving..."}
              {autoSaveStatus === "saved" && "All changes saved"}
            </div>
            <button
              type="button"
              onClick={handleSyncToCourse}
              disabled={isSyncing || !canSync}
              title={
                canSync
                  ? undefined
                  : "Offline: reconnect and refresh before syncing"
              }
              className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-60"
            >
              {isSyncing
                ? "Syncing..."
                : courseStatus === "published"
                  ? "Save changes"
                  : "Save draft"}
            </button>
            {courseStatus !== "published" && (
              <button
                type="button"
                onClick={handlePublishCourse}
                disabled={isSyncing || !canSync || !isWalletConnectedAndVerified}
                title={
                  !canSync
                    ? "Offline: reconnect and refresh before publishing"
                    : !isWalletConnectedAndVerified
                      ? "Connect your verified wallet before publishing"
                      : undefined
                }
                className="rounded-full border border-emerald-200 bg-emerald-50 px-5 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition disabled:opacity-60"
              >
                Publish course
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {hasLegacy && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Legacy content blocks were detected. They will be preserved when you
            sync, but they are not editable here yet.
          </div>
        )}

        <div
          ref={containerRef}
          className="relative flex flex-1 min-h-0 rounded-3xl border border-white/70 bg-white/80 shadow-soft overflow-hidden"
        >
          {isSidebarOpen && (
            <div
              className="fixed inset-0 z-20 bg-slate-900/30 md:hidden"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}

          <aside
            className={`absolute inset-y-0 left-0 z-30 flex flex-col border-r border-slate-200 bg-white/95 transition-[width,transform] duration-300 ease-in-out md:static md:translate-x-0 ${
              isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
            style={{
              width: sidebarCollapsed ? SIDEBAR_COLLAPSED : sidebarWidth,
            }}
          >
            {!sidebarCollapsed && (
              <div
                onMouseDown={(event) => {
                  event.preventDefault();
                  setIsResizing(true);
                }}
                className="absolute right-0 top-0 h-full w-2 cursor-col-resize hidden md:block"
              />
            )}

            <div
              className={`flex items-center py-4 border-b border-slate-200 ${
                sidebarCollapsed
                  ? "justify-center px-2"
                  : "justify-between px-4"
              }`}
            >
              {!sidebarCollapsed && (
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Lessons
                  </p>
                  <p className="text-sm font-medium text-slate-700">
                    {lessons.length} items
                  </p>
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed((prev) => !prev)}
                  title={
                    sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
                  }
                  aria-label={
                    sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
                  }
                  className={`rounded-full border border-slate-200 py-1 text-xs font-semibold text-slate-600 ${
                    sidebarCollapsed ? "px-2" : "px-3"
                  }`}
                >
                  {sidebarCollapsed ? ">" : "<"}
                </button>
                {!sidebarCollapsed && (
                  <button
                    type="button"
                    onClick={() => setIsSidebarOpen(false)}
                    className="md:hidden rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                  >
                    Close
                  </button>
                )}
              </div>
            </div>

            <div
              className={`flex-1 overflow-y-auto py-4 space-y-2 ${
                sidebarCollapsed ? "px-2" : "px-3"
              }`}
            >
              <DndContext
                sensors={sensors}
                collisionDetection={pointerWithin}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
              >
                <SortableContext
                  items={lessonIds}
                  strategy={verticalListSortingStrategy}
                >
                  {lessons.map((lesson) => (
                    <LessonRow
                      key={lesson.id}
                      lesson={lesson}
                      isSelected={lesson.id === activeLesson?.id}
                      isCollapsed={collapsedLessonIds.has(lesson.id)}
                      isSidebarCollapsed={sidebarCollapsed}
                      onSelect={() => {
                        setSelectedLessonId(lesson.id);
                        setIsSidebarOpen(false);
                      }}
                      onToggleCollapse={() => toggleLessonCollapse(lesson.id)}
                      onStartRename={() => startRename(lesson)}
                      editingTitle={editingTitle}
                      isEditing={editingLessonId === lesson.id}
                      onCommitRename={commitRename}
                      onChangeTitle={setEditingTitle}
                    />
                  ))}
                </SortableContext>

                <DragOverlay>
                  {activeDragId && (
                    <div className="pointer-events-none translate-x-3 -translate-y-1 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-2 shadow-xl ring-2 ring-emerald-200/60">
                      <p className="text-sm font-medium text-slate-800">
                        {lessons.find((lesson) => lesson.id === activeDragId)
                          ?.title || "Lesson"}
                      </p>
                    </div>
                  )}
                </DragOverlay>
              </DndContext>

              <div className="border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={() => addLesson()}
                  className="w-full rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300 transition"
                >
                  {sidebarCollapsed ? "+" : "+ New lesson"}
                </button>
              </div>
            </div>
          </aside>

          <main className="flex-1 min-w-0 min-h-0 p-6 md:p-10 space-y-6 overflow-y-auto">
            {activeLesson ? (
              <>
                <LessonBasics
                  lesson={activeLesson}
                  onUpdate={(updates) => updateLesson(activeLesson.id, updates)}
                />
                  <ContentLessonEditor
                    lesson={activeLesson}
                    onDelete={() => removeLesson(activeLesson.id)}
                    onChangeContent={(next) =>
                      updateLesson(activeLesson.id, { content: next })
                    }
                    onAddQuiz={() => openQuizBuilder(activeLesson)}
                    onEditQuiz={(quiz) => openQuizBuilder(activeLesson, quiz)}
                  />
                <section className="rounded-3xl border border-white/60 bg-white/70 p-6 shadow-soft">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Comments
                  </p>
                  <h3 className="text-lg font-semibold text-slate-900 mt-1">
                    Lesson discussion
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Threaded comments for the selected lesson block.
                  </p>

                  <div className="mt-4 space-y-3">
                    <textarea
                      value={newCommentText}
                      onChange={(event) => setNewCommentText(event.target.value)}
                      rows={3}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                      placeholder="Write a comment..."
                    />
                    <button
                      type="button"
                      disabled={postingComment}
                      onClick={() => handlePostComment()}
                      className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {postingComment ? "Posting..." : "Post comment"}
                    </button>
                  </div>

                  {commentsLoading && (
                    <p className="mt-4 text-sm text-slate-500">Loading comments...</p>
                  )}

                  {commentsError && (
                    <p className="mt-4 text-sm text-rose-600">{commentsError}</p>
                  )}

                  {!commentsLoading && !commentsError && comments.length === 0 && (
                    <p className="mt-4 text-sm text-slate-500">
                      No comments yet for this lesson.
                    </p>
                  )}

                  {!commentsLoading &&
                    !commentsError &&
                    comments.map((comment) => renderComment(comment))}
                </section>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                Select or create a lesson to start editing.
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default CourseContents;
