import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

interface CourseMetricsResponse {
  course: {
    id: string;
    title: string;
    description: string;
    status?: "draft" | "published";
    rewardPool?: {
      totalAmount: number;
      remaining: number;
      winnersCount: number;
      paidOut: number;
      totalWinners: number;
    };
  };
  metrics: {
    views: number;
    sales: number;
    revenue: number;
    reviewsCount: number;
    avgRating: number;
  };
  analytics?: {
    cohortFunnels: {
      overall: {
        views: number;
        enrolled: number;
        started: number;
        active: number;
        completed: number;
        startRate: number;
        completionRate: number;
      };
      cohorts: Array<{
        cohort: string;
        label: string;
        enrolled: number;
        started: number;
        completed: number;
        startRate: number;
        completionRate: number;
      }>;
    };
    quizPassRates: {
      overall: {
        attempts: number;
        passedAttempts: number;
        passRate: number;
        learnersAttempted: number;
        learnersPassed: number;
        learnerPassRate: number;
        averageScore: number;
      };
      byChapter: Array<{
        blockIndex: number;
        title: string;
        attempts: number;
        passedAttempts: number;
        passRate: number;
        learnersAttempted: number;
        learnersPassed: number;
        learnerPassRate: number;
        averageScore: number;
      }>;
    };
    dropOffHeatmap: {
      totalStages: number;
      stages: Array<{
        blockIndex: number;
        title: string;
        reachedCount: number;
        completedCount: number;
        nextStageCount: number;
        dropOffCount: number;
        dropOffRate: number;
      }>;
    };
    revenueBreakdown: {
      totalRevenue: number;
      averageOrderValue: number;
      monthly: Array<{
        month: string;
        revenue: number;
        sales: number;
      }>;
      tiers: Array<{
        tier: string;
        sales: number;
        revenue: number;
      }>;
      topCustomers: Array<{
        userId: string;
        name: string;
        email?: string;
        totalSpent: number;
        purchases: number;
      }>;
    };
  };
  reviews: Array<{
    name?: string;
    rating: number;
    comment?: string;
    createdAt: string;
  }>;
  recentWinners: Array<{
    userId: string;
    name: string;
    walletAddress?: string;
    amount: number;
    txSignature?: string;
    awardedAt?: string;
  }>;
}

interface CourseRewardsResponse {
  course: {
    id: string;
    title: string;
  };
  rewardPool: {
    totalAmount: number;
    remaining: number;
    winnersCount: number;
    paidOut: number;
    totalWinners: number;
  };
  recentWinners: Array<{
    userId: string;
    name: string;
    walletAddress?: string;
    amount: number;
    txSignature?: string;
    awardedAt?: string;
  }>;
}

const shortenWallet = (address?: string) =>
  address && address.length > 12
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : address || "Wallet unavailable";

const toPercent = (value: number) => `${Number(value || 0).toFixed(1)}%`;

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
  const [rewards, setRewards] = useState<CourseRewardsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [metricsRes, rewardsRes] = await Promise.all([
          api.get(`/courses/${id}/metrics`, {
            headers: { "x-auth-token": token },
          }),
          api.get(`/courses/${id}/rewards`),
        ]);
        setData(metricsRes.data);
        setRewards(rewardsRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (token && id) {
      fetchDashboardData();
    }
  }, [token, id]);

  const trendValues = useMemo(() => {
    const monthly = data?.analytics?.revenueBreakdown?.monthly || [];
    if (monthly.length > 0) {
      return monthly.map((point) => Math.max(0, Math.round(point.revenue)));
    }
    const seed = data?.metrics.sales ? data.metrics.sales * 4 : 6;
    return Array.from({ length: 8 }).map((_, index) =>
      Math.max(1, Math.round(seed + index * (seed / 4))),
    );
  }, [data?.analytics?.revenueBreakdown?.monthly, data?.metrics.sales]);

  const viewTrend = useMemo(() => {
    const cohorts = data?.analytics?.cohortFunnels?.cohorts || [];
    if (cohorts.length > 0) {
      return cohorts.map((cohort) => Math.max(0, cohort.enrolled));
    }
    const seed = data?.metrics.views ? data.metrics.views / 6 : 8;
    return Array.from({ length: 8 }).map((_, index) =>
      Math.max(1, Math.round(seed + index * (seed / 3))),
    );
  }, [data?.analytics?.cohortFunnels?.cohorts, data?.metrics.views]);

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

  const analytics = data.analytics;

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <Link to="/dashboard" className="text-xs uppercase text-emerald-600">
              Back to dashboard
            </Link>
            <div className="flex items-center gap-3 mt-2">
              <h1 className="text-3xl font-semibold text-slate-900">
                {data.course.title}
              </h1>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                  data.course.status === "draft"
                    ? "bg-slate-100 text-slate-600"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {data.course.status === "draft" ? "Draft" : "Published"}
              </span>
            </div>
            <p className="text-sm text-slate-600 mt-2 max-w-2xl">
              {data.course.description}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to={`/courses/${id}/settings`}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 transition"
            >
              Course settings
            </Link>
            <Link
              to={`/courses/${id}/contents`}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 transition"
            >
              View course contents
            </Link>
            {/* <Link
              to="/courses/new"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 transition"
            >
              Create another course
            </Link> */}
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

        <section className="grid lg:grid-cols-2 gap-6">
          <div className="rounded-3xl border border-white/60 bg-white/70 p-6 shadow-soft">
            <p className="text-xs uppercase text-slate-400">Reward Pool</p>
            <h2 className="text-lg font-semibold text-slate-900 mt-1">
              Payout progress
            </h2>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <p>
                Total pool:{" "}
                <span className="font-semibold text-slate-900">
                  {((rewards?.rewardPool?.totalAmount || 0) / 1e9).toFixed(2)} SOL
                </span>
              </p>
              <p>
                Paid out:{" "}
                <span className="font-semibold text-slate-900">
                  {((rewards?.rewardPool?.paidOut || 0) / 1e9).toFixed(2)} SOL
                </span>
              </p>
              <p>
                Remaining:{" "}
                <span className="font-semibold text-slate-900">
                  {((rewards?.rewardPool?.remaining || 0) / 1e9).toFixed(2)} SOL
                </span>
              </p>
              <p>
                Winners:{" "}
                <span className="font-semibold text-slate-900">
                  {rewards?.rewardPool?.totalWinners || 0} /{" "}
                  {rewards?.rewardPool?.winnersCount || 0}
                </span>
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/60 bg-white/70 p-6 shadow-soft">
            <p className="text-xs uppercase text-slate-400">Leaderboard</p>
            <h2 className="text-lg font-semibold text-slate-900 mt-1">
              Recent winners
            </h2>
            <div className="mt-4 space-y-3">
              {(rewards?.recentWinners || []).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                  No payouts yet. Winners will appear after course completion.
                </div>
              ) : (
                (rewards?.recentWinners || []).map((winner, index) => (
                  <div
                    key={`${winner.userId}-${winner.awardedAt || index}`}
                    className="rounded-2xl border border-slate-100 bg-white p-4"
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {winner.name} won {(winner.amount / 1e9).toFixed(3)} SOL
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {shortenWallet(winner.walletAddress)}
                    </p>
                    {winner.awardedAt && (
                      <p className="text-xs text-slate-400 mt-1">
                        {new Date(winner.awardedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
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

        {analytics && (
          <>
            <section className="rounded-3xl border border-white/60 bg-white/70 p-6 shadow-soft">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase text-slate-400">Cohorts</p>
                  <h2 className="text-lg font-semibold text-slate-900 mt-1">
                    Funnel performance
                  </h2>
                </div>
                <span className="text-sm text-slate-500">
                  Completion {toPercent(analytics.cohortFunnels.overall.completionRate)}
                </span>
              </div>

              <div className="mt-4 grid md:grid-cols-5 gap-3">
                {[
                  {
                    label: "Views",
                    value: analytics.cohortFunnels.overall.views,
                  },
                  {
                    label: "Enrolled",
                    value: analytics.cohortFunnels.overall.enrolled,
                  },
                  {
                    label: "Started",
                    value: analytics.cohortFunnels.overall.started,
                  },
                  {
                    label: "Active (14d)",
                    value: analytics.cohortFunnels.overall.active,
                  },
                  {
                    label: "Completed",
                    value: analytics.cohortFunnels.overall.completed,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-slate-100 bg-white p-3"
                  >
                    <p className="text-xs uppercase text-slate-400">{item.label}</p>
                    <p className="text-xl font-semibold text-slate-900 mt-2">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-5 space-y-3">
                {analytics.cohortFunnels.cohorts.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No cohort data available yet.
                  </p>
                ) : (
                  analytics.cohortFunnels.cohorts.map((cohort) => (
                    <div
                      key={cohort.cohort}
                      className="rounded-2xl border border-slate-100 bg-white p-4"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900">
                          {cohort.label}
                        </p>
                        <p className="text-xs text-slate-500">
                          Start {toPercent(cohort.startRate)} • Complete{" "}
                          {toPercent(cohort.completionRate)}
                        </p>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        {cohort.enrolled} enrolled • {cohort.started} started •{" "}
                        {cohort.completed} completed
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="grid lg:grid-cols-2 gap-6">
              <div className="rounded-3xl border border-white/60 bg-white/70 p-6 shadow-soft">
                <p className="text-xs uppercase text-slate-400">Quiz Pass Rates</p>
                <h2 className="text-lg font-semibold text-slate-900 mt-1">
                  Assessment quality signals
                </h2>
                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  <p>
                    Attempt pass rate:{" "}
                    <span className="font-semibold text-slate-900">
                      {toPercent(analytics.quizPassRates.overall.passRate)}
                    </span>
                  </p>
                  <p>
                    Learner pass rate:{" "}
                    <span className="font-semibold text-slate-900">
                      {toPercent(analytics.quizPassRates.overall.learnerPassRate)}
                    </span>
                  </p>
                  <p>
                    Average score:{" "}
                    <span className="font-semibold text-slate-900">
                      {analytics.quizPassRates.overall.averageScore.toFixed(1)}%
                    </span>
                  </p>
                  <p>
                    Attempts:{" "}
                    <span className="font-semibold text-slate-900">
                      {analytics.quizPassRates.overall.attempts}
                    </span>
                  </p>
                </div>
                <div className="mt-4 space-y-2 max-h-80 overflow-y-auto pr-1">
                  {analytics.quizPassRates.byChapter.map((chapter) => (
                    <div
                      key={`quiz-${chapter.blockIndex}`}
                      className="rounded-xl border border-slate-100 bg-white px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-slate-700 truncate">{chapter.title}</p>
                        <p className="text-xs font-semibold text-emerald-700">
                          {toPercent(chapter.passRate)}
                        </p>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {chapter.passedAttempts}/{chapter.attempts} attempts passed
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/60 bg-white/70 p-6 shadow-soft">
                <p className="text-xs uppercase text-slate-400">Drop-off Heatmap</p>
                <h2 className="text-lg font-semibold text-slate-900 mt-1">
                  Chapter-level attrition
                </h2>
                <div className="mt-4 space-y-2 max-h-96 overflow-y-auto pr-1">
                  {analytics.dropOffHeatmap.stages.map((stage) => {
                    const intensity = Math.min(100, Math.max(0, stage.dropOffRate));
                    return (
                      <div
                        key={`drop-${stage.blockIndex}`}
                        className="rounded-xl border border-slate-100 bg-white px-3 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm text-slate-700 truncate">{stage.title}</p>
                          <p className="text-xs font-semibold text-rose-700">
                            {toPercent(stage.dropOffRate)}
                          </p>
                        </div>
                        <div className="mt-2 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-2 bg-rose-400"
                            style={{ width: `${intensity}%` }}
                          />
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                          {stage.reachedCount} reached • {stage.nextStageCount} moved on •{" "}
                          {stage.dropOffCount} dropped
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/60 bg-white/70 p-6 shadow-soft">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase text-slate-400">Revenue Breakdown</p>
                  <h2 className="text-lg font-semibold text-slate-900 mt-1">
                    Monetization detail
                  </h2>
                </div>
                <span className="text-sm text-slate-500">
                  AOV {(analytics.revenueBreakdown.averageOrderValue / 1e9).toFixed(3)} SOL
                </span>
              </div>

              <div className="mt-4 grid md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-slate-100 bg-white p-4">
                  <p className="text-xs uppercase text-slate-400">Monthly Revenue</p>
                  <div className="mt-3 space-y-2">
                    {analytics.revenueBreakdown.monthly.map((month) => (
                      <div
                        key={month.month}
                        className="flex items-center justify-between text-sm text-slate-600"
                      >
                        <span>{month.month}</span>
                        <span className="font-semibold text-slate-900">
                          {(month.revenue / 1e9).toFixed(3)} SOL
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-white p-4">
                  <p className="text-xs uppercase text-slate-400">Price Tiers</p>
                  <div className="mt-3 space-y-2">
                    {analytics.revenueBreakdown.tiers.map((tier) => (
                      <div key={tier.tier} className="text-sm text-slate-600">
                        <p className="font-medium text-slate-800">{tier.tier}</p>
                        <p>
                          {tier.sales} sales • {(tier.revenue / 1e9).toFixed(3)} SOL
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-white p-4">
                  <p className="text-xs uppercase text-slate-400">Top Customers</p>
                  <div className="mt-3 space-y-2">
                    {analytics.revenueBreakdown.topCustomers.length === 0 ? (
                      <p className="text-sm text-slate-500">No purchases yet.</p>
                    ) : (
                      analytics.revenueBreakdown.topCustomers.map((customer) => (
                        <div key={customer.userId} className="text-sm text-slate-600">
                          <p className="font-medium text-slate-800">{customer.name}</p>
                          <p>
                            {(customer.totalSpent / 1e9).toFixed(3)} SOL •{" "}
                            {customer.purchases} purchases
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

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
