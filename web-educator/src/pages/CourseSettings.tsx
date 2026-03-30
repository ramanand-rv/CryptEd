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
          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save settings"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CourseSettings;
