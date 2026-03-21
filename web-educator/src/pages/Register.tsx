import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Register: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    const result = await register(email, password, name);
    setIsSubmitting(false);
    if (result.success) {
      navigate("/dashboard");
    } else {
      setError(result.error || "Registration failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="relative w-full max-w-5xl grid lg:grid-cols-[0.9fr_1.1fr] gap-8 items-center">
        <div className="glass-panel shadow-soft rounded-3xl border border-white/60 p-8 animate-fade-in order-2 lg:order-1">
          <h2 className="text-2xl font-semibold text-slate-900">
            Create your educator account
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Build courses, grow your audience, and earn on-chain.
          </p>
          {error && (
            <div className="mt-4 bg-rose-100 text-rose-700 p-3 rounded-xl text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4 mt-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium">
                Full name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full mt-2 rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                placeholder="Alex Rivera"
                required
              />
            </div>
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
                placeholder="At least 6 characters"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-emerald-600 text-white py-3 rounded-xl font-medium transition hover:bg-emerald-700 disabled:opacity-70"
            >
              {isSubmitting ? "Creating account..." : "Create account"}
            </button>
          </form>
          <p className="text-center text-sm text-slate-600 mt-6">
            Already have an account?{" "}
            <Link to="/login" className="text-emerald-700 font-semibold">
              Login
            </Link>
          </p>
        </div>

        <div className="space-y-6 animate-fade-up order-1 lg:order-2">
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-700">
            Launch faster
          </p>
          <h1 className="text-4xl md:text-5xl font-semibold text-slate-900 text-balance">
            Turn lessons into a beautiful on-chain classroom.
          </h1>
          <p className="text-base text-slate-600 max-w-lg">
            Craft immersive courses with AI-assisted quizzes, NFT credentials,
            and analytics you can act on.
          </p>
          <div className="grid grid-cols-2 gap-3 max-w-sm">
            {["Live metrics", "Custom payouts", "Learner insights", "Smart rewards"].map(
              (tag) => (
                <div
                  key={tag}
                  className="rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-sm text-slate-700 shadow-soft"
                >
                  {tag}
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
