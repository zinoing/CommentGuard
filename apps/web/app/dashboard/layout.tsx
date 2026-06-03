"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signIn } from "next-auth/react";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/comments", label: "Comments" },
  { href: "/dashboard/cases", label: "Cases" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center text-ink-48 text-xs">
        Loading…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-canvas-parchment flex flex-col items-center justify-center gap-5">
        <p className="text-[17px] text-ink-48 leading-[1.47] tracking-[-0.374px]">
          Sign in to access the dashboard
        </p>
        <button
          onClick={() => signIn("google")}
          className="bg-brand-blue text-white text-[17px] leading-none tracking-[-0.374px] rounded-full px-[22px] py-[11px] hover:bg-brand-blue-focus active:scale-95 transition-all"
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-canvas-parchment">
      {/* Global nav — surface-black, 44px */}
      <header className="sticky top-0 z-50 bg-surface-black h-11 flex items-center px-5">
        <Link href="/" className="text-white text-xs tracking-tight font-medium flex-1">
          CommentGuard
        </Link>
        <span className="text-white/50 text-[10px] tracking-tight truncate max-w-[200px]">
          {session.user?.email}
        </span>
      </header>

      {/* Sub-nav — frosted parchment, 52px */}
      <div className="sticky top-11 z-40 bg-canvas-parchment/80 backdrop-blur-xl border-b border-divider-hairline h-[52px] flex items-center px-5 gap-7">
        {NAV.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`text-[14px] leading-[1.29] tracking-[-0.224px] transition-colors ${
              pathname === href
                ? "text-brand-blue font-semibold"
                : "text-ink-48 hover:text-ink"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Page content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
