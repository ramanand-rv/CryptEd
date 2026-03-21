import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

interface CourseMetricsResponse {
  course: {
    id: string;
    title: string;
    description: string;
  };
  metrics: {
    views: number;
    sales: number;
    revenue: number;
    reviewsCount: number;
    avgRating: number;
  };
  reviews: Array<{
    name?: string;
    rating: number;
    comment?: string;
    createdAt: string;
  }>;
}

const TrendLine: React.FC<{ values: number[]; color: string }> = ({
  values,
  color,
}) => {
  const width = 240;
  const height = 90;
  const padding = 10;
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;
  const points = values.map((value, index) => {
    const x = padding + index * step;
    const y = height - padding - (value / max) * (height - padding * 2);
    return `${x},${y}`;
  });

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth="2" />
      {points.map((point, index) => (
        <circle
          key={`${point}-${index}`}
          cx={parseFloat(point.split(",")[0])}
          cy={parseFloat(point.split(",")[1])}
          r={index === points.length - 1 ? 3.5 : 2.5}
          fill={color}
        />
      ))}
    </svg>
  );
};

const CourseDashboard: React.FC = () => {
  const { id } = useParams();
  const { token } = useAuth();
  const [data, setData] = useState<CourseMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await api.get(`/courses/${id}/metrics`, {
          headers: { "x-auth-token": token },
        });
        setData(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (token && id) {
      fetchMetrics();
    }
  }, [token, id]);

  const trendValues = useMemo(() => {
    const seed = data?.metrics.sales ? data.metrics.sales * 4 : 6;
    return Array.from({ length: 8 }).map((_, index) =>
      Math.max(1, Math.round(seed + index * (seed / 4))),
    );
  }, [data?.metrics.sales]);

  const viewTrend = useMemo(() => {
    const seed = data?.metrics.views ? data.metrics.views / 6 : 8;
    return Array.from({ length: 8 }).map((_, index) =>
      Math.max(1, Math.round(seed + index * (seed / 3))),
    );
  }, [data?.metrics.views]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-emerald-600"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="rounded-3xl border border-white/60 bg-white/70 p-8 shadow-soft text-center">
          <p className="text-sm text-slate-600">Course metrics unavailable.</p>
          <Link
            to="/dashboard"
            className="mt-4 inline-flex items-center justify-center rounded-full bg-emerald-600 px-4 py-2 text-sm text-white"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <Link to="/dashboard" className="text-xs uppercase text-emerald-600">
              Back to dashboard
            </Link>
            <h1 className="text-3xl font-semibold text-slate-900 mt-2">
              {data.course.title}
            </h1>
            <p className="text-sm text-slate-600 mt-2 max-w-2xl">
              {data.course.description}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/courses/new"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 transition"
            >
              Create another course
            </Link>
            <Link
              to="/profile"
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition"
            >
              Profile
            </Link>
          </div>
        </div>

        <section className="grid md:grid-cols-2 xl:grid-cols-4 gap-5">
          {[
            { label: "Views", value: data.metrics.views },
            { label: "Sales", value: data.metrics.sales },
            {
              label: "Revenue (SOL)",
              value: (data.metrics.revenue / 1e9).toFixed(2),
            },
            {
              label: "Avg rating",
              value: data.metrics.avgRating
                ? data.metrics.avgRating.toFixed(1)
                : "N/A",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-3xl border border-white/60 bg-white/70 p-6 shadow-soft"
            >
              <p className="text-xs uppercase text-slate-400">{stat.label}</p>
              <p className="text-2xl font-semibold text-slate-900 mt-3">
                {stat.value}
              </p>
            </div>
          ))}
        </section>

        <section className="grid lg:grid-cols-[1.2fr_1fr] gap-6">
          <div className="rounded-3xl border border-white/60 bg-white/70 p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-slate-400">Momentum</p>
                <h2 className="text-lg font-semibold text-slate-900 mt-1">
                  Sales trajectory
                </h2>
              </div>
              <span className="text-sm text-emerald-700">
                {data.metrics.sales} enrollments
              </span>
            </div>
            <div className="mt-4">
              <TrendLine values={trendValues} color="#0f766e" />
            </div>
          </div>

          <div className="rounded-3xl border border-white/60 bg-white/70 p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-slate-400">Visibility</p>
                <h2 className="text-lg font-semibold text-slate-900 mt-1">
                  Views pulse
                </h2>
              </div>
              <span className="text-sm text-amber-600">
                {data.metrics.views} total views
              </span>
            </div>
            <div className="mt-4">
              <TrendLine values={viewTrend} color="#d97706" />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/60 bg-white/70 p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase text-slate-400">Reviews</p>
              <h2 className="text-lg font-semibold text-slate-900 mt-1">
                Learner feedback
              </h2>
            </div>
            <span className="text-sm text-slate-500">
              {data.metrics.reviewsCount} reviews
            </span>
          </div>
          <div className="mt-6 space-y-4">
            {data.reviews.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                No reviews yet. Encourage learners to share feedback.
              </div>
            ) : (
              data.reviews.map((review, index) => (
                <div
                  key={`${review.createdAt}-${index}`}
                  className="rounded-2xl border border-slate-100 bg-white p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {review.name || "Learner"}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-sm text-emerald-700">
                      {review.rating} / 5
                    </span>
                  </div>
                  {review.comment && (
                    <p className="text-sm text-slate-600 mt-3">
                      {review.comment}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default CourseDashboard;
