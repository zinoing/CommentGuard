"use client";
import { useRouter } from "next/navigation";

const POSTS = [
  {
    id: "vid_90210_cx",
    title: "BREAKING: Major policy shift…",
    duration: "12:45",
    channel: "Global News Network",
    platform: "yt",
    flagged: 1242,
    critHigh: 482,
    dominantRisk: { level: "crit", label: "Hate speech" },
    status: { level: "crit", label: "Escalated" },
    lastScan: "2m ago",
  },
  {
    id: "vid_55321_ww",
    title: "Live Discussion: Urban policy",
    duration: "21:10",
    channel: "Civic Discourse",
    platform: "yt",
    flagged: 2109,
    critHigh: 198,
    dominantRisk: { level: "crit", label: "Toxicity" },
    status: { level: "crit", label: "Escalated" },
    lastScan: "45m ago",
  },
  {
    id: "vid_44521_rt",
    title: "The Ultimate Workstation Setup",
    duration: "18:12",
    channel: "Tech Horizon",
    platform: "ig",
    flagged: 356,
    critHigh: 121,
    dominantRisk: { level: "high", label: "Spam / Bots" },
    status: { level: "med", label: "Attention" },
    lastScan: "15m ago",
  },
  {
    id: "vid_33210_as",
    title: "Cloud Migration Strategies",
    duration: "08:15",
    channel: "Enterprise IT",
    platform: "ig",
    flagged: 188,
    critHigh: 54,
    dominantRisk: { level: "med", label: "Misinfo" },
    status: { level: "med", label: "Attention" },
    lastScan: "3h ago",
  },
  {
    id: "vid_11098_kl",
    title: "Weekly Market Analysis: Retail",
    duration: "05:33",
    channel: "Finance Daily",
    platform: "yt",
    flagged: 42,
    critHigh: 2,
    dominantRisk: { level: "neutral", label: "Neutral" },
    status: { level: "ok", label: "Normal" },
    lastScan: "1h ago",
  },
];

export default function PostsPage() {
  const router = useRouter();

  return (
    <>
      <div className="disclaimer">
        <span className="di">⚠</span>
        <span>
          Automated periodic scanning is active. Risk levels are derived by the detection engine from sentiment volatility
          &amp; harmful-content signals. No legal or moderation actions occur on this page.
        </span>
      </div>

      <div className="page-head">
        <div>
          <h1>Posts</h1>
          <div className="sub">Content overview — which videos &amp; posts are driving comment risk</div>
        </div>
      </div>

      {/* Search + filters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="searchbar">
          <div className="cg-input">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" />
            </svg>
            Search by video title or channel name…
          </div>
          <button className="btn primary">Search</button>
        </div>
        <details className="adv">
          <summary><span className="chev">▸</span> Advanced filters</summary>
          <div className="adv-body">
            <div className="fields">
              <div className="field">
                <span className="fl">CHANNEL</span>
                <div className="cg-select">All channels <span className="cv">▾</span></div>
              </div>
              <div className="field">
                <span className="fl">PLATFORM</span>
                <div className="cg-select">All platforms <span className="cv">▾</span></div>
              </div>
              <div className="field">
                <span className="fl">STATUS</span>
                <div className="cg-select">All statuses <span className="cv">▾</span></div>
              </div>
              <div className="field">
                <span className="fl">DATE RANGE</span>
                <div className="cg-select">Last 7 days <span className="cv">▾</span></div>
              </div>
            </div>
            <div className="cg-row je g10 mt16">
              <button className="btn sm ghost">Reset</button>
              <button className="btn sm primary">Apply filters</button>
            </div>
          </div>
        </details>
      </div>

      {/* Table */}
      <div className="card pad0">
        <div className="tbl-wrap">
          <table className="tbl" style={{ minWidth: 920 }}>
            <thead>
              <tr>
                <th>Content</th>
                <th>Channel</th>
                <th>Platform</th>
                <th>Flagged</th>
                <th>Crit + High</th>
                <th>Dominant risk</th>
                <th>Status</th>
                <th>Last scan</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {POSTS.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="cg-row ac g10">
                      <div className="thumb">{p.duration}</div>
                      <div>
                        <div className="cg-strong">{p.title}</div>
                        <div className="cg-mono cellsub">{p.id}</div>
                      </div>
                    </div>
                  </td>
                  <td>{p.channel}</td>
                  <td>
                    <span className={`pf ${p.platform}`}>{p.platform === "yt" ? "▶" : "◉"}</span>
                  </td>
                  <td className="num-cell tabnums">{p.flagged.toLocaleString()}</td>
                  <td
                    className="num-cell tabnums"
                    style={{ color: p.critHigh > 100 ? "var(--crit-ink)" : "var(--high-ink)" }}
                  >
                    {p.critHigh.toLocaleString()}
                  </td>
                  <td>
                    <span className={`badge ${p.dominantRisk.level}`}>{p.dominantRisk.label}</span>
                  </td>
                  <td>
                    <span className={`badge ${p.status.level}`}>{p.status.label}</span>
                  </td>
                  <td className="muted cg-small">{p.lastScan}</td>
                  <td>
                    <button className="cg-link" onClick={() => router.push("/dashboard/comments")}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pager">
          <span>Showing 1–5 of 1,245 posts · sorted by Crit + High</span>
          <div className="pages">
            <span className="pg active">1</span>
            <span className="pg">2</span>
            <span className="pg">3</span>
            <span className="pg ghost">…</span>
            <span className="pg">63</span>
          </div>
        </div>
      </div>

      <div className="cg-tiny muted mt12">
        Status is system-calculated &amp; read-only. Click View to see a post's comments.
      </div>
    </>
  );
}
