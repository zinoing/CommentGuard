"use client";
import { useState } from "react";
import CommentDetailSlideOver from "@/components/CommentDetailSlideOver";
import {
  FILTER_TYPES,
  RiskTypeFilter,
  RiskTypeBadges,
  riskTypeMatchesFilter,
} from "@/components/RiskTypeFilter";

const COMMENTS = [
  {
    id: "cmt_001",
    author: "User_4492",
    authorMeta: "2.4k followers",
    text: "\"This is completely fabricated and I will be contacting my lawyer about this channel.\"",
    legalRisk: 92,
    brandImpact: 41,
    urgency: { level: "crit", label: "Critical" },
    status: { cls: "new", label: "New" },
    updated: "2m ago",
    riskTypes: ["Defamation – False Facts", "Threat"],
  },
  {
    id: "cmt_002",
    author: "InvestSmart_32",
    authorMeta: "verified",
    text: "\"Their sponsored claims are misleading and probably defamatory toward competitors.\"",
    legalRisk: 58,
    brandImpact: 84,
    urgency: { level: "high", label: "Elevated" },
    status: { cls: "reviewed", label: "Reviewed" },
    updated: "14m ago",
    riskTypes: ["Defamation – True Facts", "Advertiser Risk"],
  },
  {
    id: "cmt_003",
    author: "RegulatoryWatch",
    authorMeta: "",
    text: "\"This may violate advertising disclosure regulations in several regions.\"",
    legalRisk: 65,
    brandImpact: 30,
    urgency: { level: "med", label: "Standard" },
    status: { cls: "linked", label: "Case-linked" },
    updated: "1h ago",
    riskTypes: ["Advertiser Risk"],
  },
];

type SortKey = "legal" | "bsafe" | "urgency" | "updated";

const SORT_OPTIONS: { key: SortKey; label: string; desc: string }[] = [
  { key: "urgency", label: "Urgency", desc: "Urgency (high → low)" },
  { key: "legal", label: "Legal risk", desc: "Legal risk (high → low)" },
  { key: "bsafe", label: "Brand impact", desc: "Brand impact (high → low)" },
  { key: "updated", label: "Updated", desc: "Updated (most recent)" },
];

const URGENCY_RANK: Record<string, number> = { crit: 4, high: 3, med: 2, low: 1 };

function sortRows(rows: typeof COMMENTS, key: SortKey) {
  return [...rows].sort((a, b) => {
    if (key === "legal") return b.legalRisk - a.legalRisk;
    if (key === "bsafe") return b.brandImpact - a.brandImpact;
    if (key === "urgency") return URGENCY_RANK[b.urgency.level] - URGENCY_RANK[a.urgency.level];
    return 0;
  });
}

const PAGE_SIZE = 3;

export default function CommentListPage() {
  const [slideOverOpen, setSlideOverOpen] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("legal");
  const [sortOpen, setSortOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterUrgency, setFilterUrgency] = useState("");
  const [filterLegalRisk, setFilterLegalRisk] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedRiskTypes, setSelectedRiskTypes] = useState<Set<string>>(new Set(FILTER_TYPES));
  const [page, setPage] = useState(1);

  const filtered = COMMENTS.filter((c) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!c.text.toLowerCase().includes(q) && !c.author.toLowerCase().includes(q)) return false;
    }
    if (filterUrgency && c.urgency.level !== filterUrgency) return false;
    if (filterLegalRisk && c.legalRisk < parseInt(filterLegalRisk)) return false;
    if (filterStatus && c.status.cls !== filterStatus) return false;
    if (!riskTypeMatchesFilter(c.riskTypes, selectedRiskTypes)) return false;
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
    setFilterLegalRisk("");
    setFilterStatus("");
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
      <div className="disclaimer info">
        <span className="di">ⓘ</span>
        <span>
          Risk detection is enhanced by sentiment analysis. Scores reflect liability &amp; brand-safety thresholds and
          are provided for reference only — not legal advice.
        </span>
      </div>

      <div className="page-head">
        <div>
          <h1>Comment List</h1>
          <div className="sub">Detailed triage of flagged comments under one post</div>
        </div>
      </div>

      {/* Post info card */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="cg-row ac jb cg-wrap g16">
          <div className="cg-row ac g12">
            <div className="thumb" style={{ width: 72, height: 44 }}>12:45</div>
            <div>
              <div className="cg-strong">BREAKING: Major policy shift announced…</div>
              <div className="cg-mono cellsub">VID-98122-C · Global News Network · YouTube</div>
            </div>
          </div>
          <div className="cg-row g16">
            <div className="cg-center">
              <div className="cg-strong tabnums" style={{ fontSize: 22 }}>38</div>
              <div className="cg-tiny muted">flagged</div>
            </div>
            <div className="divider" style={{ width: 1, height: 34 }} />
            <div className="cg-center">
              <div className="cg-strong tabnums" style={{ fontSize: 22, color: "var(--ok-ink)" }}>92%</div>
              <div className="cg-tiny muted">safe ratio</div>
            </div>
          </div>
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
              placeholder="Search within comments…"
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
                  <option value="high">Elevated</option>
                  <option value="med">Standard</option>
                </select>
              </div>
              <div className="field">
                <span className="fl">LEGAL RISK</span>
                <select className="cg-select" value={filterLegalRisk} onChange={onFilterChange(setFilterLegalRisk)}>
                  <option value="">Any score</option>
                  <option value="50">≥ 50</option>
                  <option value="70">≥ 70</option>
                  <option value="90">≥ 90</option>
                </select>
              </div>
              <div className="field">
                <span className="fl">STATUS</span>
                <select className="cg-select" value={filterStatus} onChange={onFilterChange(setFilterStatus)}>
                  <option value="">All statuses</option>
                  <option value="new">New</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="linked">Case-linked</option>
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
              <div className="sort-pop" style={{ display: "block" }} onClick={(e) => e.stopPropagation()}>
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
          <table className="tbl" style={{ minWidth: 960 }}>
            <thead>
              <tr>
                <th className="colcheck" />
                <th>Comment</th>
                <th>Risk scores</th>
                <th>Urgency</th>
                <th>Risk type</th>
                <th>Status</th>
                <th>Updated</th>
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
                    <div className="cg-small">{row.text}</div>
                    <div className="cg-mono cellsub">
                      {row.author}{row.authorMeta ? ` · ${row.authorMeta}` : ""}
                    </div>
                  </td>
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
                    <span className={`cg-status ${row.status.cls}`}>
                      <span className="d" />
                      {row.status.label}
                    </span>
                  </td>
                  <td className="muted cg-small">{row.updated}</td>
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
              : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, sorted.length)} of ${sorted.length} flagged`}
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
