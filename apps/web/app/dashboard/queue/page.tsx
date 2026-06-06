"use client";
import { useState } from "react";
import CommentDetailSlideOver from "@/components/CommentDetailSlideOver";
import {
  FILTER_TYPES,
  RiskTypeFilter,
  RiskTypeBadges,
  riskTypeMatchesFilter,
} from "@/components/RiskTypeFilter";

const QUEUE = [
  {
    id: "node_8842",
    thread: "Q4 Audit thread",
    excerpt: "\"They will regret crossing this line, mark my…\"",
    channel: "Main Hub",
    legalRisk: 98,
    brandImpact: 55,
    urgency: { level: "crit", label: "Critical" },
    riskTypes: ["Threat", "Persistent Harassment"],
    pending: "26h",
    pendingWarn: true,
  },
  {
    id: "anon_01",
    thread: "Privacy Update",
    excerpt: "\"Your data handling clearly breaches…\"",
    channel: "Gaming Portal",
    legalRisk: 82,
    brandImpact: 60,
    urgency: { level: "high", label: "High" },
    riskTypes: ["Defamation – False Facts"],
    pending: "28h",
    pendingWarn: true,
  },
  {
    id: "sec_pro",
    thread: "Open Dev",
    excerpt: "\"Here is the unpatched endpoint anyone can…\"",
    channel: "Main Hub",
    legalRisk: 74,
    brandImpact: 38,
    urgency: { level: "high", label: "High" },
    riskTypes: ["Organized Attack"],
    pending: "4h",
    pendingWarn: false,
  },
  {
    id: "user_553",
    thread: "Pricing",
    excerpt: "\"That pricing claim is just not accurate…\"",
    channel: "Lifestyle Daily",
    legalRisk: 45,
    brandImpact: 30,
    urgency: { level: "med", label: "Medium" },
    riskTypes: ["Defamation – True Facts", "Advertiser Risk"],
    pending: "32h",
    pendingWarn: true,
  },
  {
    id: "spam_bot4",
    thread: "Community",
    excerpt: "\"Check out my channel for free giveaways…\"",
    channel: "Gaming Portal",
    legalRisk: 12,
    brandImpact: 18,
    urgency: { level: "low", label: "Low" },
    riskTypes: ["Advertiser Risk"],
    pending: "10m",
    pendingWarn: false,
  },
];

const CHANNELS = [...new Set(QUEUE.map((r) => r.channel))];

type SortKey = "urgency" | "legal" | "bsafe" | "pending";

const SORT_OPTIONS: { key: SortKey; label: string; desc: string }[] = [
  { key: "urgency", label: "Urgency", desc: "Urgency (high → low)" },
  { key: "legal", label: "Legal risk", desc: "Legal risk (high → low)" },
  { key: "bsafe", label: "Brand impact", desc: "Brand impact (high → low)" },
  { key: "pending", label: "Pending", desc: "Pending (oldest first)" },
];

const URGENCY_RANK: Record<string, number> = { crit: 4, high: 3, med: 2, low: 1 };

function sortRows(rows: typeof QUEUE, key: SortKey) {
  return [...rows].sort((a, b) => {
    if (key === "urgency") return URGENCY_RANK[b.urgency.level] - URGENCY_RANK[a.urgency.level];
    if (key === "legal") return b.legalRisk - a.legalRisk;
    if (key === "bsafe") return b.brandImpact - a.brandImpact;
    return 0;
  });
}

const PAGE_SIZE = 5;

export default function RiskQueuePage() {
  const [slideOverOpen, setSlideOverOpen] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("urgency");
  const [sortOpen, setSortOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterUrgency, setFilterUrgency] = useState("");
  const [filterChannel, setFilterChannel] = useState("");
  const [filterLegalScore, setFilterLegalScore] = useState("");
  const [filterPending, setFilterPending] = useState("");
  const [selectedRiskTypes, setSelectedRiskTypes] = useState<Set<string>>(new Set(FILTER_TYPES));
  const [page, setPage] = useState(1);

  const filtered = QUEUE.filter((r) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !r.excerpt.toLowerCase().includes(q) &&
        !r.channel.toLowerCase().includes(q) &&
        !r.thread.toLowerCase().includes(q)
      ) return false;
    }
    if (filterUrgency && r.urgency.level !== filterUrgency) return false;
    if (filterChannel && r.channel !== filterChannel) return false;
    if (filterLegalScore && r.legalRisk < parseInt(filterLegalScore)) return false;
    if (filterPending === "24h" && !r.pendingWarn) return false;
    if (!riskTypeMatchesFilter(r.riskTypes, selectedRiskTypes)) return false;
    return true;
  });

  const sorted = sortRows(filtered, sortKey);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const allChecked = filtered.length > 0 && filtered.every((r) => checked.has(r.id));

  function toggleAll() {
    if (allChecked) {
      setChecked((prev) => {
        const next = new Set(prev);
        filtered.forEach((r) => next.delete(r.id));
        return next;
      });
    } else {
      setChecked((prev) => new Set([...prev, ...filtered.map((r) => r.id)]));
    }
  }

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function resetFilters() {
    setSearchQuery("");
    setFilterUrgency("");
    setFilterChannel("");
    setFilterLegalScore("");
    setFilterPending("");
    setSelectedRiskTypes(new Set(FILTER_TYPES));
    setPage(1);
  }

  function onFilterChange(setter: (v: string) => void) {
    return (e: React.ChangeEvent<HTMLSelectElement>) => {
      setter(e.target.value);
      setPage(1);
    };
  }

  const currentSort = SORT_OPTIONS.find((o) => o.key === sortKey)!;

  return (
    <>
      <div className="disclaimer">
        <span className="di">⚠</span>
        <span>
          This queue reflects the most recent periodic scan (Jun 3, 11:00 PM). Newly detected comments appear after the
          next scan. Actions here are advisory and do not alter platform content.
        </span>
      </div>

      <div className="page-head">
        <div>
          <h1>Risk Queue</h1>
          <div className="sub">Newly flagged, case-unlinked comments · sorted by urgency</div>
        </div>
        <div className="actions">
          <span className="badge outline">{filtered.length} entries</span>
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
              placeholder="Search risk queue by comment, user, or thread…"
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
                <span className="fl">URGENCY</span>
                <select className="cg-select" value={filterUrgency} onChange={onFilterChange(setFilterUrgency)}>
                  <option value="">All levels</option>
                  <option value="crit">Critical</option>
                  <option value="high">High</option>
                  <option value="med">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div className="field">
                <span className="fl">CHANNEL</span>
                <select className="cg-select" value={filterChannel} onChange={onFilterChange(setFilterChannel)}>
                  <option value="">All channels</option>
                  {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="field">
                <span className="fl">LEGAL SCORE</span>
                <select className="cg-select" value={filterLegalScore} onChange={onFilterChange(setFilterLegalScore)}>
                  <option value="">Any score</option>
                  <option value="70">≥ 70</option>
                  <option value="80">≥ 80</option>
                  <option value="90">≥ 90</option>
                </select>
              </div>
              <div className="field">
                <span className="fl">PENDING SINCE</span>
                <select className="cg-select" value={filterPending} onChange={onFilterChange(setFilterPending)}>
                  <option value="">Any duration</option>
                  <option value="24h">&gt; 24h</option>
                </select>
              </div>
              <RiskTypeFilter
                selected={selectedRiskTypes}
                onChange={(s) => { setSelectedRiskTypes(s); setPage(1); }}
              />
            </div>
            <div className="cg-row je g10 mt16">
              <button className="btn sm ghost" onClick={resetFilters}>Reset</button>
              <button className="btn sm primary" onClick={() => setPage(1)}>Apply filters</button>
            </div>
          </div>
        </details>
      </div>

      {/* Toolbar */}
      <div className="list-toolbar">
        <label className="sel" style={{ cursor: "pointer" }}>
          <span
            className="cbx"
            role="checkbox"
            aria-checked={allChecked}
            tabIndex={0}
            onClick={toggleAll}
            onKeyDown={(e) => (e.key === " " || e.key === "Enter") && toggleAll()}
          />
          <span className="cg-strong cg-small">Select all</span>
          {checked.size > 0 && <span className="sel-count">· {checked.size} selected</span>}
        </label>
        <div className="toolbar-right">
          <div className="sortmenu" style={{ position: "relative" }}>
            <button
              className="btn sm sort-btn"
              onClick={(e) => { e.stopPropagation(); setSortOpen((o) => !o); }}
            >
              <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3" />
              </svg>
              Sort: <b>{currentSort.label}</b> ▾
            </button>
            {sortOpen && (
              <div className="sort-pop" style={{ display: "block" }}
                onClick={(e) => e.stopPropagation()}
              >
                {SORT_OPTIONS.map((o) => (
                  <div
                    key={o.key}
                    className={`sort-opt${sortKey === o.key ? " active" : ""}`}
                    onClick={() => { setSortKey(o.key); setSortOpen(false); setPage(1); }}
                  >
                    {o.desc}
                    <span className="tick">✓</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button className="btn sm">
            <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" />
            </svg>
            Export selected
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card pad0">
        <div className="tbl-wrap">
          <table className="tbl" style={{ minWidth: 1020 }}>
            <thead>
              <tr>
                <th className="colcheck" />
                <th>Comment</th>
                <th>Channel</th>
                <th>Risk scores</th>
                <th>Urgency</th>
                <th>Risk type</th>
                <th>Pending</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pageRows.length > 0 ? pageRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <span
                      className="cbx"
                      role="checkbox"
                      aria-checked={checked.has(row.id)}
                      tabIndex={0}
                      onClick={() => toggle(row.id)}
                      onKeyDown={(e) => (e.key === " " || e.key === "Enter") && toggle(row.id)}
                    />
                  </td>
                  <td>
                    <div className="muted cg-small">{row.excerpt}</div>
                    <div className="cg-mono cellsub">{row.id} · {row.thread}</div>
                  </td>
                  <td>{row.channel}</td>
                  <td>
                    <div className="scores">
                      <div className="score legal">
                        <div className="top"><span className="nm">Legal risk</span><span className="vl">{row.legalRisk}</span></div>
                        <div className="track"><i style={{ width: `${row.legalRisk}%` }} /></div>
                      </div>
                      <div className="score bsafe">
                        <div className="top"><span className="nm">Brand impact</span><span className="vl">{row.brandImpact}</span></div>
                        <div className="track"><i style={{ width: `${row.brandImpact}%` }} /></div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${row.urgency.level}`}><span className="dot" />{row.urgency.label}</span>
                  </td>
                  <td>
                    <RiskTypeBadges types={row.riskTypes} />
                  </td>
                  <td>
                    {row.pendingWarn ? (
                      <span className="badge outline">⏱ {row.pending}</span>
                    ) : (
                      <span className="muted cg-small">{row.pending}</span>
                    )}
                  </td>
                  <td>
                    <button className="cg-link" onClick={() => setSlideOverOpen(true)}>View</button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "32px 0", color: "var(--ink-faint)" }}>
                    No results found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="pager">
          <span>
            {sorted.length === 0
              ? "No results"
              : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, sorted.length)} of ${sorted.length}`}
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

      <CommentDetailSlideOver isOpen={slideOverOpen} onClose={() => setSlideOverOpen(false)} />
    </>
  );
}
