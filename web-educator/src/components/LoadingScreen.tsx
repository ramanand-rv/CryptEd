import React from "react";

const LoadingScreen: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="relative w-full max-w-md">
        <div className="absolute -top-16 -left-16 h-40 w-40 rounded-full bg-emerald-200/40 blur-3xl animate-float" />
        <div className="absolute -bottom-16 -right-20 h-48 w-48 rounded-full bg-amber-200/40 blur-3xl animate-float" />

        <div className="glass-panel shadow-soft rounded-3xl border border-white/50 p-8 text-center animate-fade-in">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-600">
            Loading
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-900">
            Preparing your studio
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Syncing courses, metrics, and creativity.
          </p>
          <div className="mt-6 flex items-center justify-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce" />
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:150ms]" />
            <span className="h-2 w-2 rounded-full bg-emerald-300 animate-bounce [animation-delay:300ms]" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
