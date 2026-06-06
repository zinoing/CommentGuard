"use client";
import { useState } from "react";

const VAULT_ENTRIES = [
  {
    id: "EV-9821-X",
    caseId: "CASE-204",
    channel: "Global News Network",
    commentId: "UCz…89aB",
    hash: "e3b0c44298…",
    acquired: "10-24 14:02",
    status: { cls: "neutral", label: "Draft" },
  },
  {
    id: "EV-9820-T",
    caseId: "CASE-198",
    channel: "Tech Horizon",
    commentId: "UCm…22kP",
    hash: "813511ea63…",
    acquired: "10-24 11:45",
    status: { cls: "info", label: "Finalized" },
  },
  {
    id: "EV-9819-Q",
    caseId: "CASE-192",
    channel: "Finance Daily",
    commentId: "UCp…77xZ",
    hash: "cf83e1357e…",
    acquired: "10-23 18:22",
    status: { cls: "med", label: "Shared" },
  },
];

const CUSTODY = [
  { title: "Acquired via official API", meta: "Automated collection · engine v1.4.2", date: "2023-10-24 14:02:11 UTC" },
  { title: "Hash sealed & stored", meta: "SHA-256 computed · written to vault", date: "2023-10-24 14:02:12 UTC" },
  { title: "Linked to CASE-204", meta: "by operator J. Park", date: "2023-10-24 15:20:46 UTC" },
  { title: "Integrity re-verified", meta: "Scheduled check · match ✓", date: "2023-10-25 00:00:03 UTC" },
];

const CHANNELS = [...new Set(VAULT_ENTRIES.map((e) => e.channel))];
const PAGE_SIZE = 3;

export default function VaultPage() {
  const [view, setView] = useState<"list" | "entry">("list");
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterChannel, setFilterChannel] = useState("");
  const [page, setPage] = useState(1);

  const filtered = VAULT_ENTRIES.filter((e) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !e.id.toLowerCase().includes(q) &&
        !e.commentId.toLowerCase().includes(q) &&
        !e.caseId.toLowerCase().includes(q)
      ) return false;
    }
    if (filterStatus && e.status.label !== filterStatus) return false;
    if (filterChannel && e.channel !== filterChannel) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const allChecked = filtered.length > 0 && filtered.every((e) => checked.has(e.id));

  function toggleAll() {
    if (allChecked) {
      setChecked((prev) => {
        const next = new Set(prev);
        filtered.forEach((e) => next.delete(e.id));
        return next;
      });
    } else {
      setChecked((prev) => new Set([...prev, ...filtered.map((e) => e.id)]));
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
    setFilterStatus("");
    setFilterChannel("");
    setPage(1);
  }

  function onFilterChange(setter: (v: string) => void) {
    return (e: React.ChangeEvent<HTMLSelectElement>) => {
      setter(e.target.value);
      setPage(1);
    };
  }

  if (view === "entry") {
    return (
      <>
        <div className="cg-row ac g10" style={{ marginBottom: 16 }}>
          <button className="cg-link" onClick={() => setView("list")}>‹ Back to vault</button>
        </div>

        <div className="page-head">
          <div>
            <h1 style={{ fontSize: 22 }}>Evidence record EV-9821-X</h1>
            <div className="sub">Officially acquired · read-only after acquisition</div>
          </div>
          <div className="actions">
            <span className="badge neutral">Draft</span>
            <span className="badge info">🔒 Immutable</span>
          </div>
        </div>

        <div className="disclaimer info">
          <span className="di">ⓘ</span>
          <span>
            This record was acquired via the official platform API and is cryptographically sealed.
            Its contents cannot be edited; only its status and access links may change.
          </span>
        </div>

        <div className="cgrid g-2" style={{ alignItems: "start" }}>
          {/* Left column */}
          <div className="cg-col g16">
            <div className="card">
              <div className="eyebrow" style={{ marginBottom: 14 }}>Record details</div>
              <dl className="kv">
                <dt>Linked case</dt>
                <dd className="cg-strong">CASE-204 <span className="muted cg-small">· Defamation (open)</span></dd>
                <dt>Comment ID</dt>
                <dd className="cg-mono">UCz…89aB</dd>
                <dt>Source video</dt>
                <dd>VID-98122-C <span className="muted cg-small">· YouTube</span></dd>
                <dt>Acquisition</dt>
                <dd>Official platform API <span style={{ color: "var(--ok-ink)" }}>✓ verified</span></dd>
                <dt>Acquired at</dt>
                <dd className="cg-mono">2023-10-24 14:02:11 UTC</dd>
                <dt>Status</dt>
                <dd><span className="badge neutral">Draft</span></dd>
              </dl>
            </div>

            <div className="card">
              <div className="eyebrow" style={{ marginBottom: 12 }}>Captured comment</div>
              <div className="cg-row ac g8" style={{ marginBottom: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--surface-3)" }} />
                <span className="cg-strong cg-small">@justice_seeker_99</span>
              </div>
              <div className="commentbox">
                &ldquo;This is completely fabricated and I will be contacting my lawyer about this channel.
                Everyone should know the truth here.&rdquo;
              </div>
            </div>

            <div className="card">
              <div className="cg-row jb ac" style={{ marginBottom: 10 }}>
                <div className="eyebrow">Integrity · SHA-256</div>
                <span className="badge ok"><span className="dot" />Verified</span>
              </div>
              <div className="hashbox">
                e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="cg-col g16">
            <div className="card">
              <div className="eyebrow" style={{ marginBottom: 16 }}>Chain of custody</div>
              <div className="timeline">
                {CUSTODY.map((c) => (
                  <div className="tl" key={c.date}>
                    <span className="dot" />
                    <div className="t">{c.title}</div>
                    <div className="m">{c.meta}</div>
                    <div className="d">{c.date}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="eyebrow" style={{ marginBottom: 8 }}>Read-only access link</div>
              <div className="cg-tiny muted" style={{ marginBottom: 8 }}>Presigned · expires in 72h</div>
              <div className="hashbox">
                https://vault.commentguard.io/ev/EV-9821-X?sig=AKIA…f29c&amp;exp=1730&amp;dl=ro
              </div>
              <div className="cg-row g8 mt12">
                <button className="btn sm">⧉ Copy link</button>
                <button className="btn sm ghost">↻ Regenerate</button>
              </div>
            </div>

            <div className="cg-col g8">
              <button className="btn primary">
                <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" />
                </svg>
                Export record (PDF + hash)
              </button>
              <div className="cg-row g8">
                <button className="btn cg-grow">Share via link</button>
                <button className="btn cg-grow">Finalize record</button>
              </div>
              <div className="cg-tiny muted cg-center" style={{ marginTop: 4 }}>
                Record content is immutable. CommentGuard does not modify or archive acquired evidence.
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="disclaimer info">
        <span className="di">ⓘ</span>
        <span>
          Evidence is collected exclusively via official platform APIs and is immutable after acquisition.
          Phase-1 public-scan data is never stored here.
        </span>
      </div>

      <div className="page-head">
        <div>
          <h1>Evidence Vault</h1>
          <div className="sub">Immutable legal records of officially-acquired interactions</div>
        </div>
        <div className="actions">
          <button className="btn">
            <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" />
            </svg>
            Export all
          </button>
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
              placeholder="Search by Evidence ID, Case ID, or Comment ID…"
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
                <span className="fl">STATUS</span>
                <select className="cg-select" value={filterStatus} onChange={onFilterChange(setFilterStatus)}>
                  <option value="">All statuses</option>
                  <option value="Draft">Draft</option>
                  <option value="Finalized">Finalized</option>
                  <option value="Shared">Shared</option>
                </select>
              </div>
              <div className="field">
                <span className="fl">CHANNEL</span>
                <select className="cg-select" value={filterChannel} onChange={onFilterChange(setFilterChannel)}>
                  <option value="">All channels</option>
                  {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
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
        <button className="btn sm">
          <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" />
          </svg>
          Export selected
        </button>
      </div>

      {/* Table */}
      <div className="card pad0">
        <div className="tbl-wrap">
          <table className="tbl" style={{ minWidth: 840 }}>
            <thead>
              <tr>
                <th className="colcheck" />
                <th>Evidence ID</th>
                <th>Case ID</th>
                <th>Comment</th>
                <th>Source</th>
                <th>SHA-256</th>
                <th>Acquired</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pageRows.length > 0 ? pageRows.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <span
                      className="cbx"
                      role="checkbox"
                      aria-checked={checked.has(entry.id)}
                      tabIndex={0}
                      onClick={() => toggle(entry.id)}
                      onKeyDown={(e) => (e.key === " " || e.key === "Enter") && toggle(entry.id)}
                    />
                  </td>
                  <td className="cg-strong cg-mono">{entry.id}</td>
                  <td className="cg-strong">{entry.caseId}</td>
                  <td className="cg-mono">{entry.commentId}</td>
                  <td><span className="badge ok"><span className="dot" />Official API</span></td>
                  <td className="cg-mono">{entry.hash}</td>
                  <td className="cg-mono">{entry.acquired}</td>
                  <td><span className={`badge ${entry.status.cls}`}>{entry.status.label}</span></td>
                  <td>
                    <button className="cg-link" onClick={() => setView("entry")}>View</button>
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
              : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length} entr${filtered.length !== 1 ? "ies" : "y"}`}
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
    </>
  );
}
