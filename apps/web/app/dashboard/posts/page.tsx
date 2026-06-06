"use client";
import { useState } from "react";
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

const PAGE_SIZE = 5;
const CHANNELS = [...new Set(POSTS.map((p) => p.channel))];

export default function PostsPage() {
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterChannel, setFilterChannel] = useState("");
  const [filterPlatform, setFilterPlatform] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterRisk, setFilterRisk] = useState("");
  const [page, setPage] = useState(1);

  const filtered = POSTS.filter((p) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!p.title.toLowerCase().includes(q) && !p.channel.toLowerCase().includes(q)) return false;
    }
    if (filterChannel && p.channel !== filterChannel) return false;
    if (filterPlatform && p.platform !== filterPlatform) return false;
    if (filterStatus && p.status.label !== filterStatus) return false;
    if (filterRisk && p.dominantRisk.level !== filterRisk) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function resetFilters() {
    setSearchQuery("");
    setFilterChannel("");
    setFilterPlatform("");
    setFilterStatus("");
    setFilterRisk("");
    setPage(1);
  }

  function onFilterChange(setter: (v: string) => void) {
    return (e: React.ChangeEvent<HTMLSelectElement>) => {
      setter(e.target.value);
      setPage(1);
    };
  }

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
            <input
              type="text"
              placeholder="Search by video title or channel name…"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              onKeyDown={(e) => e.key === "Enter" && setPage(1)}
            />
          </div>
          <button className="btn primary" onClick={() => setPage(1)}>Search</button>
        </div>
        <details className="adv">
          <summary><span className="chev">▸</span> Advanced filters</summary>
          <div className="adv-body">
            <div className="fields">
              <div className="field">
                <span className="fl">CHANNEL</span>
                <select className="cg-select" value={filterChannel} onChange={onFilterChange(setFilterChannel)}>
                  <option value="">All channels</option>
                  {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="field">
                <span className="fl">PLATFORM</span>
                <select className="cg-select" value={filterPlatform} onChange={onFilterChange(setFilterPlatform)}>
                  <option value="">All platforms</option>
                  <option value="yt">YouTube</option>
                  <option value="ig">Instagram</option>
                </select>
              </div>
              <div className="field">
                <span className="fl">STATUS</span>
                <select className="cg-select" value={filterStatus} onChange={onFilterChange(setFilterStatus)}>
                  <option value="">All statuses</option>
                  <option value="Escalated">Escalated</option>
                  <option value="Attention">Attention</option>
                  <option value="Normal">Normal</option>
                </select>
              </div>
              <div className="field">
                <span className="fl">RISK LEVEL</span>
                <select className="cg-select" value={filterRisk} onChange={onFilterChange(setFilterRisk)}>
                  <option value="">All levels</option>
                  <option value="crit">Critical</option>
                  <option value="high">High</option>
                  <option value="med">Medium</option>
                  <option value="neutral">Neutral</option>
                </select>
              </div>
            </div>
            <div className="cg-row je g10 mt16">
              <button className="btn sm ghost" onClick={resetFilters}>Reset</button>
              <button className="btn sm primary" onClick={() => setPage(1)}>Apply filters</button>
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
              {pageRows.length > 0 ? pageRows.map((p) => (
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
              )) : (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: "32px 0", color: "var(--ink-faint)" }}>
                    No results found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="pager">
          <span>
            {filtered.length === 0
              ? "No results"
              : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length} post${filtered.length !== 1 ? "s" : ""}`}
          </span>
          <div className="pages">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <span
                key={p}
                className={`pg${page === p ? " active" : ""}`}
                onClick={() => setPage(p)}
                style={{ cursor: "pointer" }}
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="cg-tiny muted mt12">
        Status is system-calculated &amp; read-only. Click View to see a post's comments.
      </div>
    </>
  );
}
