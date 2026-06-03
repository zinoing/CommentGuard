import Link from "next/link";

const FEATURES = [
  { title: "Collect", desc: "YouTube and Instagram comment collection with quota management." },
  { title: "Classify", desc: "ML risk scoring across legal, brand, and urgency dimensions." },
  { title: "Preserve", desc: "Evidence packaging with chain-of-custody logging and PDF export." },
];

export default function Home() {
  return (
    <div className="min-h-screen antialiased">
      {/* Global nav */}
      <header className="sticky top-0 z-50 bg-surface-black h-11 flex items-center px-5">
        <span className="text-white text-xs tracking-tight flex-1 font-medium">CommentGuard</span>
        <Link
          href="/dashboard"
          className="text-white/70 hover:text-white text-xs tracking-tight transition-colors"
        >
          Dashboard
        </Link>
      </header>

      {/* Hero tile — white canvas */}
      <section className="bg-canvas flex flex-col items-center text-center py-20 px-6">
        <h1 className="font-display font-semibold text-ink leading-[1.07] tracking-[-0.28px] text-[56px] mb-4">
          CommentGuard
        </h1>
        <p className="text-[28px] text-ink-48 leading-[1.14] tracking-[0.196px] mb-10 max-w-xl font-normal">
          Collect, classify, and preserve comments<br />as legal-grade evidence.
        </p>
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="bg-brand-blue text-white text-[17px] leading-none tracking-[-0.374px] rounded-full px-[22px] py-[11px] hover:bg-brand-blue-focus active:scale-95 transition-all"
          >
            Open Dashboard
          </Link>
          <Link
            href="#features"
            className="text-brand-blue text-[17px] leading-none tracking-[-0.374px] border border-brand-blue rounded-full px-[22px] py-[11px] hover:bg-blue-50 active:scale-95 transition-all"
          >
            Learn more
          </Link>
        </div>
      </section>

      {/* Feature tile — dark */}
      <section id="features" className="bg-surface-tile1 flex flex-col items-center text-center py-20 px-6">
        <h2 className="font-display font-semibold text-white text-[40px] leading-[1.1] mb-4">
          Platform-grade monitoring.
        </h2>
        <p className="text-[24px] text-white/50 leading-[1.5] font-light mb-14 max-w-2xl">
          From collection to court-ready evidence package — end to end.
        </p>
        <div className="grid grid-cols-3 gap-5 max-w-3xl w-full text-left">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-surface-tile2 rounded-[18px] p-6">
              <h3 className="font-semibold text-white text-[17px] leading-[1.24] tracking-[-0.374px] mb-2">
                {f.title}
              </h3>
              <p className="text-white/50 text-[14px] leading-[1.43] tracking-[-0.224px]">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Parchment tile — disclaimer */}
      <section className="bg-canvas-parchment flex flex-col items-center text-center py-20 px-6">
        <h2 className="font-display font-semibold text-ink text-[34px] leading-[1.47] tracking-[-0.374px] mb-3">
          Built for legal teams.
        </h2>
        <p className="text-[17px] text-ink-48 leading-[1.47] tracking-[-0.374px] max-w-lg">
          All risk scores are reference indicators only and do not constitute legal determinations.
          Always consult qualified legal counsel.
        </p>
      </section>

      {/* Footer */}
      <footer className="bg-canvas-parchment border-t border-divider-hairline py-16 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-[12px] text-ink-48 tracking-[-0.12px] font-medium">CommentGuard</span>
          <span className="text-[12px] text-ink-48 tracking-[-0.12px]">
            © 2026 CommentGuard. All rights reserved.
          </span>
        </div>
      </footer>
    </div>
  );
}
