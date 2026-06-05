"use client";
import { useEffect } from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function CommentDetailSlideOver({ isOpen, onClose }: Props) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <>
      <div className={`scrim${isOpen ? " open" : ""}`} onClick={onClose} />
      <aside className={`slideover${isOpen ? " open" : ""}`}>
        <div className="so-head">
          <div>
            <div className="cg-strong">Comment Intelligence</div>
            <div className="cg-mono cg-tiny muted">Internal ID · CG-8842-X</div>
          </div>
          <button className="x" onClick={onClose}>✕</button>
        </div>

        <div className="so-body">
          {/* Author */}
          <div className="cg-row ac g10">
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--surface-3)", flex: "0 0 auto" }} />
            <div>
              <div className="cg-strong cg-small">@justice_seeker_99</div>
              <div className="cg-tiny muted">Posted 2h ago · detected 1h ago · 2.4k followers</div>
            </div>
          </div>

          {/* Comment */}
          <div className="commentbox">
            &ldquo;This is completely fabricated and I will be contacting my lawyer about this channel. Everyone should know the truth here.&rdquo;
          </div>

          {/* Risk score metrics */}
          <div>
            <div className="cg-row jb ac mb12">
              <div className="eyebrow">Risk score metrics</div>
              <span className="badge crit"><span className="dot" />Critical</span>
            </div>
            <div className="cg-col g12">
              <div className="metric">
                <div className="top"><span>Legal risk</span><b>87</b></div>
                <div className="track"><i style={{ width: "87%", background: "var(--score-legal)" }} /></div>
              </div>
              <div className="metric">
                <div className="top"><span>Brand impact</span><b>61</b></div>
                <div className="track"><i style={{ width: "61%", background: "var(--score-brand)" }} /></div>
              </div>
              <div className="cg-row jb ac" style={{ paddingTop: 2 }}>
                <span className="cg-small muted">Urgency</span>
                <span className="badge crit"><span className="dot" />Critical</span>
              </div>
            </div>
          </div>

          {/* Classification */}
          <div>
            <div className="eyebrow mb12">Classification</div>
            <div className="chips-row">
              <span className="badge crit">Defamation (false facts)</span>
              <span className="badge high">Legal threat</span>
            </div>
            <div className="cg-mono cg-tiny muted" style={{ borderLeft: "3px solid var(--border-strong)", paddingLeft: 9, marginTop: 10 }}>
              ICT Network Act Art. 70 — reference only
            </div>
          </div>

          <div className="disclaimer info" style={{ margin: 0 }}>
            <span className="di">ⓘ</span>
            <span>Classification is for reference only and does not constitute legal advice. Consult your legal department.</span>
          </div>

          {/* Account behavior pattern */}
          <div>
            <div className="eyebrow mb12">Account behavior pattern</div>
            <div className="acct-grid">
              <div className="acct-stat">
                <div className="acct-val tabnums">148</div>
                <div className="acct-lbl">Comments / 30d</div>
              </div>
              <div className="acct-stat">
                <div className="acct-val tabnums" style={{ color: "var(--crit-ink)" }}>62%</div>
                <div className="acct-lbl">High-risk ratio</div>
              </div>
              <div className="acct-stat">
                <div className="acct-val tabnums">New</div>
                <div className="acct-lbl">Account age</div>
              </div>
              <div className="acct-stat">
                <div className="acct-val tabnums">3</div>
                <div className="acct-lbl">Similar clusters</div>
              </div>
            </div>
            <div className="acct-flags">
              <span className="badge high">Repeat attack pattern</span>
              <span className="badge med">Coordinated cluster</span>
            </div>
            <div className="cg-tiny muted" style={{ marginTop: 8 }}>
              Patterns are anonymized aggregates — no PII stored. For reference only; take action on the platform directly.
            </div>
          </div>
        </div>

        <div className="so-foot">
          <button className="btn primary">
            <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 5h10v10M19 5L5 19" />
            </svg>
            Open on Platform
          </button>
          <button className="btn">
            <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7h18M3 12h18M3 17h12" />
            </svg>
            Request Legal Review
          </button>
          <div className="cg-tiny muted cg-center">
            CommentGuard does not delete, modify, or block content. Advisory only.
          </div>
        </div>
      </aside>
    </>
  );
}
