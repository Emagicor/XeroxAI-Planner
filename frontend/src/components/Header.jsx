function BuildingIcon() {
  return (
    <svg
      className="w-7 h-7 text-white"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.7}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 21h18M5 21V9l7-6 7 6v12M9 21v-6h6v6"
      />
    </svg>
  );
}

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/40 backdrop-blur-2xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left Section */}
          <div className="flex items-center gap-4">
            {/* Logo */}
            <div className="relative">
              <div className="absolute inset-0 bg-white/20 blur-xl rounded-2xl" />

              <div className="relative w-14 h-14 rounded-2xl border border-white/15 bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center shadow-2xl">
                <BuildingIcon />
              </div>
            </div>

            {/* Text */}
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  FloorPlan AI
                </h1>

                <span className="hidden sm:flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.25em] px-2.5 py-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                  Live
                </span>
              </div>

              <p className="mt-1 text-sm text-zinc-400">
                AI-powered room dimension extraction & smart evaluation
              </p>
            </div>
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-3">
            {/* Status */}
            <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />

              <span className="text-sm text-zinc-300 font-medium">
                System Active
              </span>
            </div>

            {/* Build Badge */}
            <div className="px-4 py-2 rounded-xl bg-gradient-to-r from-white/10 to-white/5 border border-white/10 shadow-lg">
              <span className="text-sm font-semibold tracking-wide text-white">
                Build91
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
