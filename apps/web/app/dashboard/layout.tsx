"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

// DEV ONLY — mock session, replace with real auth (NextAuth) before GA
const mockSession = {
  user: { email: "zinolubjosee@gmail.com", name: "Dev User" },
};

const NAV = [
  {
    group: "Operations",
    items: [
      {
        href: "/dashboard",
        key: "dashboard",
        label: "Dashboard",
        icon: (
          <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="9" rx="1.5" />
            <rect x="14" y="3" width="7" height="5" rx="1.5" />
            <rect x="14" y="12" width="7" height="9" rx="1.5" />
            <rect x="3" y="16" width="7" height="5" rx="1.5" />
          </svg>
        ),
      },
      {
        href: "/dashboard/posts",
        key: "posts",
        label: "Posts",
        icon: (
          <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M10 9l5 3-5 3z" fill="currentColor" stroke="none" />
          </svg>
        ),
      },
      {
        href: "/dashboard/queue",
        key: "queue",
        label: "Risk Queue",
        badge: "12",
        icon: (
          <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3l9 5-9 5-9-5z" />
            <path d="M3 13l9 5 9-5" />
          </svg>
        ),
      },
      {
        href: "/dashboard/collect",
        key: "collect",
        label: "Collect",
        icon: (
          <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3v13M7 11l5 5 5-5" />
            <path d="M5 20h14" />
          </svg>
        ),
      },
    ],
  },
  {
    group: "Legal",
    items: [
      {
        href: "/dashboard/vault",
        key: "vault",
        label: "Evidence Vault",
        icon: (
          <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M3 9h18M9 4v16" />
          </svg>
        ),
      },
      {
        href: "/dashboard/cases",
        key: "cases",
        label: "Cases",
        icon: (
          <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 7h16v12H4z" />
            <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
          </svg>
        ),
      },
    ],
  },
];

function getBreadcrumbs(pathname: string): React.ReactNode {
  if (pathname === "/dashboard") return <span className="here">Dashboard</span>;
  if (pathname === "/dashboard/posts") return <span className="here">Posts</span>;
  if (pathname === "/dashboard/queue") return <span className="here">Risk Queue</span>;
  if (pathname.startsWith("/dashboard/comments")) {
    return (
      <>
        <Link href="/dashboard/posts" className="cg-link" style={{ fontSize: 13, fontWeight: 500 }}>Posts</Link>
        <span className="sep">›</span>
        <span className="here">Comments</span>
      </>
    );
  }
  if (pathname.startsWith("/dashboard/vault")) return <span className="here">Evidence Vault</span>;
  if (pathname === "/dashboard/cases") return <span className="here">Cases</span>;
  if (pathname.startsWith("/dashboard/collect")) return <span className="here">Collect</span>;
  return <span className="here">Dashboard</span>;
}

function getActiveKey(pathname: string): string {
  if (pathname === "/dashboard") return "dashboard";
  if (pathname.startsWith("/dashboard/posts") || pathname.startsWith("/dashboard/comments")) return "posts";
  if (pathname.startsWith("/dashboard/queue")) return "queue";
  if (pathname.startsWith("/dashboard/vault")) return "vault";
  if (pathname.startsWith("/dashboard/cases")) return "cases";
  if (pathname.startsWith("/dashboard/collect")) return "collect";
  return "dashboard";
}

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [channelName, setChannelName] = useState<string>("");

  useEffect(() => {
    setChannelName(getCookie("cg_channel_name"));
  }, [pathname]);

  const session = mockSession;
  const activeKey = getActiveKey(pathname);
  const initials = session.user.name
    ? session.user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "U";
  const displayName = session.user.name ?? session.user.email;

  function handleChangeChannel() {
    document.cookie = "cg_channel_id=; path=/; max-age=0";
    document.cookie = "cg_channel_name=; path=/; max-age=0";
    router.push("/dashboard/channels");
  }

  return (
    <div className="cg-app">
      <aside className="sidebar">
        <div className="brand">
          <div className="shield" />
          <div className="bt">
            <div className="n">CommentGuard</div>
            <div className="s">Risk Management</div>
          </div>
        </div>

        {/* Current channel display */}
        {channelName && (
          <div style={{
            padding: "10px 16px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
                현재 채널
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {channelName}
              </div>
            </div>
            <button
              onClick={handleChangeChannel}
              style={{
                fontSize: 11, color: "var(--ink-3)", background: "none", border: "none",
                cursor: "pointer", padding: "2px 6px", borderRadius: "var(--r-sm)",
                flexShrink: 0,
              }}
            >
              변경
            </button>
          </div>
        )}

        <nav className="cg-nav">
          {NAV.map(({ group, items }) => (
            <div key={group}>
              <div className="lbl">{group}</div>
              {items.map(({ href, key, label, badge, icon }) => (
                <Link
                  key={key}
                  href={href}
                  className={`nav-item${activeKey === key ? " active" : ""}`}
                >
                  {icon}
                  {label}
                  {badge && <span className="nav-badge">{badge}</span>}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="foot">
          <div className="av">{initials}</div>
          <div className="who">
            <div className="a">{displayName}</div>
            <div className="b">Operations</div>
          </div>
        </div>
      </aside>

      <div className="cg-main">
        <header className="topbar">
          <div className="crumbs">{getBreadcrumbs(pathname)}</div>
          <div style={{ flex: 1 }} />
          <div className="icon-btn" title="Notifications">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.7 21a2 2 0 0 1-3.4 0" />
            </svg>
          </div>
        </header>

        <div className="cg-content">
          {children}
        </div>
      </div>
    </div>
  );
}
