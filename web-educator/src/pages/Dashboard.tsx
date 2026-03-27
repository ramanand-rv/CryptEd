import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

interface Course {
  _id: string;
  title: string;
  description: string;
  price: number;
  createdAt: string;
  views?: number;
  status?: "draft" | "published";
}

interface MetricPoint {
  label: string;
  value: number;
}

interface OverviewMetrics {
  totals: {
    courses: number;
    sales: number;
    revenue: number;
    views: number;
  };
  salesByMonth: MetricPoint[];
  viewsByMonth: MetricPoint[];
}

const LineChart: React.FC<{
  data: MetricPoint[];
  stroke: string;
  fill: string;
}> = ({ data, stroke, fill }) => {
  const width = 280;
  const height = 130;
  const padding = 18;
  const max = Math.max(...data.map((point) => point.value), 1);
  const step = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0;

  const points = data.map((point, index) => {
    const x = padding + index * step;
    const y =
      height - padding - (point.value / max) * (height - padding * 2);
    return { x, y };
  });

  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPath = `M ${padding} ${height - padding} L ${polyline} L ${
    width - padding
  } ${height - padding} Z`;

  const gradientId = `chart-${stroke.replace("#", "")}`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={fill} stopOpacity="0.5" />
          <stop offset="100%" stopColor={fill} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <polyline
        points={polyline}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
      />
      {points.map((point, index) => (
        <circle
          key={`${point.x}-${point.y}`}
          cx={point.x}
          cy={point.y}
          r={index === points.length - 1 ? 4 : 2.5}
          fill={stroke}
        />
      ))}
    </svg>
  );
};

const Dashboard: React.FC = () => {
  const { user, token, logout } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res = await api.get("/courses/educator", {
          headers: { "x-auth-token": token },
        });
        const myCourses = res.data.filter(
          (course: any) =>
            course.educatorId?._id === user?.id ||
            course.educatorId === user?.id,
        );
        setCourses(myCourses);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (token && user) {
      fetchCourses();
    }
  }, [token, user]);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await api.get("/courses/metrics/overview", {
          headers: { "x-auth-token": token },
        });
        setMetrics(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    if (token) {
      fetchMetrics();
    }
  }, [token]);

  const fallbackSeries = useMemo<MetricPoint[]>(
    () => [
      { label: "Jan", value: 0 },
      { label: "Feb", value: 0 },
      { label: "Mar", value: 0 },
      { label: "Apr", value: 0 },
      { label: "May", value: 0 },
      { label: "Jun", value: 0 },
    ],
    [],
  );

  const salesSeries = metrics?.salesByMonth?.length
    ? metrics.salesByMonth
    : fallbackSeries;
  const viewsSeries = metrics?.viewsByMonth?.length
    ? metrics.viewsByMonth
    : fallbackSeries;

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-20 border-b border-white/60 bg-white/70 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <Link to="/dashboard" className="text-lg font-semibold">
              CryptEd Studio
            </Link>
            <p className="text-xs text-slate-500">Educator HQ</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/courses/new"
              className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-soft hover:bg-emerald-700 transition"
            >
              Create course
            </Link>
            <Link
              to="/profile"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900 transition"
            >
              Profile
            </Link>
            <button
              onClick={logout}
              className="rounded-full border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 transition"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section className="grid lg:grid-cols-[1.4fr_1fr] gap-8 items-start">
          <div className="space-y-6 animate-fade-up">
            <div className="rounded-3xl border border-white/60 bg-white/70 p-6 shadow-soft">
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-700">
                Overview
              </p>
              <h1 className="text-3xl md:text-4xl font-semibold text-slate-900 mt-2">
                Welcome back, {user?.name?.split(" ")[0] || "educator"}.
              </h1>
              <p className="text-sm text-slate-600 mt-2">
                Track performance across all courses and keep momentum with your
                learners.
              </p>
              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  {
                    label: "Courses",
                    value: metrics?.totals.courses ?? courses.length,
                  },
                  {
                    label: "Sales",
                    value: metrics?.totals.sales ?? 0,
                  },
                  {
                    label: "Revenue (SOL)",
                    value: metrics
                      ? (metrics.totals.revenue / 1e9).toFixed(2)
                      : "0.00",
                  },
                  {
                    label: "Views",
                    value: metrics?.totals.views ?? 0,
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-slate-100 bg-white px-4 py-4"
                  >
                    <p className="text-xs uppercase text-slate-400">
                      {stat.label}
                    </p>
                    <p className="text-2xl font-semibold text-slate-900 mt-2">
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/60 bg-white/70 p-6 shadow-soft animate-fade-in">
            <h3 className="text-lg font-semibold text-slate-900">
              Quick actions
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Keep your studio in motion.
            </p>
            <div className="mt-6 space-y-3">
              {[
                {
                  title: "Draft a new course",
                  description: "Launch fresh content for your learners.",
                  link: "/courses/new",
                },
                {
                  title: "Review analytics",
                  description: "Track momentum and engagement.",
                  link: "/dashboard",
                },
                {
                  title: "Update payout wallet",
                  description: "Make sure your rewards flow to you.",
                  link: "/profile",
                },
              ].map((item) => (
                <Link
                  key={item.title}
                  to={item.link}
                  className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-4 hover:border-emerald-200 hover:bg-emerald-50 transition"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {item.title}
                    </p>
                    <p className="text-xs text-slate-500">{item.description}</p>
                  </div>
                  <span className="text-emerald-700 text-sm font-semibold">
                    Open
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="grid lg:grid-cols-2 gap-6">
          <div className="rounded-3xl border border-white/60 bg-white/70 p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-slate-400">Sales</p>
                <h3 className="text-lg font-semibold text-slate-900 mt-1">
                  Enrollments trend
                </h3>
              </div>
              <span className="text-sm text-emerald-700">
                {metrics?.totals.sales ?? 0} total
              </span>
            </div>
            <div className="mt-4">
              <LineChart data={salesSeries} stroke="#0f766e" fill="#a7f3d0" />
              <div className="mt-3 flex justify-between text-xs text-slate-400">
                {salesSeries.map((point) => (
                  <span key={point.label}>{point.label}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/60 bg-white/70 p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-slate-400">Views</p>
                <h3 className="text-lg font-semibold text-slate-900 mt-1">
                  Course visibility
                </h3>
              </div>
              <span className="text-sm text-amber-600">
                {metrics?.totals.views ?? 0} views
              </span>
            </div>
            <div className="mt-4">
              <LineChart data={viewsSeries} stroke="#d97706" fill="#fde68a" />
              <div className="mt-3 flex justify-between text-xs text-slate-400">
                {viewsSeries.map((point) => (
                  <span key={point.label}>{point.label}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">
                My courses
              </h2>
              <p className="text-sm text-slate-500">
                Manage content, analytics, and rewards for each course.
              </p>
            </div>
            <Link
              to="/courses/new"
              className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800 transition"
            >
              + Create new course
            </Link>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-emerald-600"></div>
            </div>
          ) : courses.length === 0 ? (
            <div className="rounded-3xl border border-white/60 bg-white/70 p-12 text-center shadow-soft">
              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                No courses yet
              </h3>
              <p className="text-sm text-slate-500 mb-6">
                Launch your first course and start tracking insights.
              </p>
              <Link
                to="/courses/new"
                className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition"
              >
                Create course
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {courses.map((course) => (
                <div
                  key={course._id}
                  className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-soft transition hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs uppercase tracking-[0.2em] ${
                        course.status === "draft"
                          ? "text-slate-500"
                          : "text-emerald-600"
                      }`}
                    >
                      {course.status === "draft" ? "Draft" : "Published"}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(course.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mt-3">
                    {course.title}
                  </h3>
                  <p className="text-sm text-slate-600 mt-2 line-clamp-3">
                    {course.description}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-900">
                      {(course.price / 1e9).toFixed(2)} SOL
                    </span>
                    <span className="text-slate-500">
                      {course.views ?? 0} views
                    </span>
                  </div>
                  <Link
                    to={`/courses/${course._id}`}
                    className="mt-5 inline-flex items-center justify-center w-full rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:border-emerald-200 hover:text-emerald-700 transition"
                  >
                    Open course dashboard
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default Dashboard;
