import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  DeleteCourseDialog,
  UnsavedChangesDialog,
} from "../components/CourseSettingsDialogs";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

interface CourseSettingsSnapshot {
  title: string;
  description: string;
  status: "draft" | "published";
}

const CourseSettings: React.FC = () => {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(
    null,
  );
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [initialSnapshot, setInitialSnapshot] = useState<CourseSettingsSnapshot>(
    {
      title: "",
      description: "",
      status: "draft",
    },
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchCourse = async () => {
      if (!id || !token) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.get(`/courses/${id}/metrics`, {
          headers: { "x-auth-token": token },
        });
        const course = res.data?.course;
        const nextTitle = course?.title || "";
        const nextDescription = course?.description || "";
        const nextStatus =
          course?.status === "published" ? "published" : "draft";

        setTitle(nextTitle);
        setDescription(nextDescription);
        setStatus(nextStatus);
        setInitialSnapshot({
          title: nextTitle.trim(),
          description: nextDescription.trim(),
          status: nextStatus,
        });
      } catch (err) {
        console.error(err);
        setError("Unable to load course settings.");
      } finally {
        setLoading(false);
      }
    };

    fetchCourse();
  }, [id, token]);

  const hasUnsavedChanges = useMemo(() => {
    return (
      title.trim() !== initialSnapshot.title ||
      description.trim() !== initialSnapshot.description ||
      status !== initialSnapshot.status
    );
  }, [title, description, status, initialSnapshot]);

  const attemptNavigation = (path: string) => {
    if (hasUnsavedChanges) {
      setPendingNavigation(path);
      setShowUnsavedConfirm(true);
      return;
    }
    navigate(path);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!id) return;
    if (!title.trim()) {
      setError("Course title is required.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const normalizedTitle = title.trim();
    const normalizedDescription = description.trim();

    try {
      await api.put(
        `/courses/${id}`,
        {
          title: normalizedTitle,
          description: normalizedDescription,
          status,
        },
        { headers: { "x-auth-token": token } },
      );
      setTitle(normalizedTitle);
      setDescription(normalizedDescription);
      setInitialSnapshot({
        title: normalizedTitle,
        description: normalizedDescription,
        status,
      });
      setSuccess("Course settings updated.");
    } catch (err) {
      console.error(err);
      setError("Failed to update course settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!title.trim()) {
      setError("Course title is required before deleting.");
      return;
    }

    setDeleting(true);
    setError(null);
    setSuccess(null);

    try {
      await api.delete(`/courses/${id}`, {
        headers: { "x-auth-token": token },
      });
      navigate("/dashboard");
    } catch (err) {
      console.error(err);
      setError("Failed to delete course.");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
      setDeleteConfirmText("");
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
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <Link
              to={`/courses/${id}`}
              onClick={(event) => {
                event.preventDefault();
                attemptNavigation(`/courses/${id}`);
              }}
              className="text-xs uppercase text-emerald-600"
            >
              Back to course dashboard
            </Link>
            <h1 className="text-3xl md:text-4xl font-semibold text-slate-900 mt-2">
              Course settings
            </h1>
            <p className="text-sm text-slate-600 mt-2 max-w-2xl">
              Update the course title and description shown to learners.
            </p>
          </div>
          <button
            type="button"
            onClick={() => attemptNavigation(`/courses/${id}/contents`)}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 transition"
          >
            View course contents
          </button>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        )}

        <form
          onSubmit={handleSave}
          className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-soft space-y-5"
        >
          <div className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Course status
                </p>
                <p className="text-xs text-slate-500">
                  Toggle between draft and published. Published courses are
                  visible to learners.
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                  status === "published"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {status === "published" ? "Published" : "Draft"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStatus("draft")}
                disabled={saving || deleting}
                className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                  status === "draft"
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 text-slate-600 hover:text-slate-900"
                }`}
              >
                Draft
              </button>
              <button
                type="button"
                onClick={() => setStatus("published")}
                disabled={saving || deleting}
                className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                  status === "published"
                    ? "bg-emerald-600 text-white"
                    : "border border-slate-200 text-slate-600 hover:text-slate-900"
                }`}
              >
                Publish
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Course title
            </label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              placeholder="Course title"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Course description
            </label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="w-full mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              rows={5}
              placeholder="Describe what learners will gain from this course."
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleting || saving}
              className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 transition disabled:opacity-60"
            >
              {deleting ? "Deleting..." : "Delete course"}
            </button>
            <button
              type="submit"
              disabled={saving || deleting}
              className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save settings"}
            </button>
          </div>
        </form>
      </div>
      {showDeleteConfirm && (
        <DeleteCourseDialog
          title={title}
          deleteConfirmText={deleteConfirmText}
          deleting={deleting}
          onConfirmTextChange={setDeleteConfirmText}
          onClose={() => {
            setShowDeleteConfirm(false);
            setDeleteConfirmText("");
          }}
          onDelete={handleDelete}
        />
      )}
      {showUnsavedConfirm && (
        <UnsavedChangesDialog
          onCancel={() => {
            setShowUnsavedConfirm(false);
            setPendingNavigation(null);
          }}
          onDiscard={() => {
            const nextPath = pendingNavigation;
            setShowUnsavedConfirm(false);
            setPendingNavigation(null);
            if (nextPath) {
              navigate(nextPath);
            }
          }}
        />
      )}
    </div>
  );
};

export default CourseSettings;
