import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    const result = await login(email, password);
    setIsSubmitting(false);
    if (result.success) {
      navigate("/dashboard");
    } else {
      setError(result.error || "Login failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="relative w-full max-w-5xl grid lg:grid-cols-[1.1fr_0.9fr] gap-8 items-center">
        <div className="space-y-6 animate-fade-up">
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-700">
            Educator Studio
          </p>
          <h1 className="text-4xl md:text-5xl font-semibold text-slate-900 text-balance">
            Welcome back to your creative teaching space.
          </h1>
          <p className="text-base text-slate-600 max-w-lg">
            Track performance, design courses with ease, and keep every learner
            engaged from day one.
          </p>
          <div className="flex flex-wrap gap-3">
            {["Metrics", "AI quizzes", "NFT rewards", "Wallet payouts"].map(
              (tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 text-xs rounded-full bg-emerald-100 text-emerald-800"
                >
                  {tag}
                </span>
              ),
            )}
          </div>
        </div>

        <div className="glass-panel shadow-soft rounded-3xl border border-white/60 p-8 animate-fade-in">
          <h2 className="text-2xl font-semibold text-slate-900">
            Educator Login
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Sign in to manage your courses and analytics.
          </p>
          {error && (
            <div className="mt-4 bg-rose-100 text-rose-700 p-3 rounded-xl text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4 mt-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full mt-2 rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                placeholder="you@studio.com"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full mt-2 rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-emerald-600 text-white py-3 rounded-xl font-medium transition hover:bg-emerald-700 disabled:opacity-70"
            >
              {isSubmitting ? "Signing in..." : "Sign In"}
            </button>
          </form>
          <p className="text-center text-sm text-slate-600 mt-6">
            Don't have an account?{" "}
            <Link to="/register" className="text-emerald-700 font-semibold">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
