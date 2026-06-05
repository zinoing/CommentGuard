"use client";
import { useState } from "react";

const VAULT_ENTRIES = [
  {
    id: "EV-9821-X",
    commentId: "UCz…89aB",
    hash: "e3b0c44298…",
    acquired: "10-24 14:02",
    status: { cls: "neutral", label: "Draft" },
  },
  {
    id: "EV-9820-T",
    commentId: "UCm…22kP",
    hash: "813511ea63…",
    acquired: "10-24 11:45",
    status: { cls: "info", label: "Finalized" },
  },
  {
    id: "EV-9819-Q",
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

export default function VaultPage() {
  const [view, setView] = useState<"list" | "entry">("list");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const allChecked = checked.size === VAULT_ENTRIES.length;

  function toggleAll() {
    setChecked(allChecked ? new Set() : new Set(VAULT_ENTRIES.map((e) => e.id)));
  }

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
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
            Search by Case ID, Comment ID, or video…
          </div>
          <button className="btn primary">Search</button>
        </div>
        <details className="adv">
          <summary><span className="chev">▸</span> Advanced filters</summary>
          <div className="adv-body">
            <div className="fields">
              <div className="field">
                <span className="fl">STATUS</span>
                <div className="cg-select">All statuses <span className="cv">▾</span></div>
              </div>
              <div className="field">
                <span className="fl">CHANNEL</span>
                <div className="cg-select">All channels <span className="cv">▾</span></div>
              </div>
              <div className="field">
                <span className="fl">SOURCE</span>
                <div className="cg-select">Official API <span className="cv">▾</span></div>
              </div>
              <div className="field">
                <span className="fl">ACQUIRED</span>
                <div className="cg-select">Last 30 days <span className="cv">▾</span></div>
              </div>
            </div>
            <div className="cg-row je g10 mt16">
              <button className="btn sm ghost">Reset</button>
              <button className="btn sm primary">Apply filters</button>
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
              {VAULT_ENTRIES.map((entry) => (
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
                  <td className="cg-strong">{entry.id}</td>
                  <td className="cg-mono">{entry.commentId}</td>
                  <td><span className="badge ok"><span className="dot" />Official API</span></td>
                  <td className="cg-mono">{entry.hash}</td>
                  <td className="cg-mono">{entry.acquired}</td>
                  <td><span className={`badge ${entry.status.cls}`}>{entry.status.label}</span></td>
                  <td>
                    <button className="cg-link" onClick={() => setView("entry")}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pager">
          <span>Showing 1–3 of 42 entries</span>
          <div className="pages">
            <span className="pg active">1</span>
            <span className="pg">2</span>
            <span className="pg">3</span>
            <span className="pg ghost">…</span>
            <span className="pg">14</span>
          </div>
        </div>
      </div>
    </>
  );
}
