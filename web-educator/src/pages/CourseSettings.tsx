import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

const CourseSettings: React.FC = () => {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
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
        setTitle(course?.title || "");
        setDescription(course?.description || "");
      } catch (err) {
        console.error(err);
        setError("Unable to load course settings.");
      } finally {
        setLoading(false);
      }
    };

    fetchCourse();
  }, [id, token]);

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

    try {
      await api.put(
        `/courses/${id}`,
        {
          title: title.trim(),
          description: description.trim(),
        },
        { headers: { "x-auth-token": token } },
      );
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
            onClick={() => navigate(`/courses/${id}/contents`)}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Confirm deletion
                </h2>
                <p className="text-sm text-slate-600 mt-2">
                  This action cannot be undone. To confirm, type{" "}
                  <span className="font-semibold text-slate-900">
                    {title || "this course"}
                  </span>{" "}
                  below.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText("");
                }}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(event) => setDeleteConfirmText(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
                placeholder="Type the course name to confirm"
              />
              <div className="flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText("");
                  }}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={
                    deleting ||
                    deleteConfirmText.trim() !== title.trim() ||
                    !title.trim()
                  }
                  className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 transition disabled:opacity-60"
                >
                  {deleting ? "Deleting..." : "Delete course"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseSettings;
