export default function CasesPage() {
  return (
    <>
      <div className="disclaimer">
        <span className="di">⚠</span>
        <span>
          Case management is a Phase 2 feature and is not active in this build.
          Evidence packages and share links will be available after Phase 1 deployment.
        </span>
      </div>

      <div className="page-head">
        <div>
          <h1>Cases</h1>
          <div className="sub">Case lifecycle management — active in Phase 2</div>
        </div>
      </div>

      <div className="card" style={{ textAlign: "center", padding: "64px 24px" }}>
        <div style={{ marginBottom: 16 }}>
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--ink-faint)"
            strokeWidth="1.5"
            style={{ margin: "0 auto" }}
          >
            <path d="M4 7h16v12H4z" />
            <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
          </svg>
        </div>
        <div className="cg-strong" style={{ fontSize: 16, marginBottom: 8 }}>
          Coming in Phase 2
        </div>
        <div className="muted" style={{ fontSize: 13.5, maxWidth: 420, margin: "0 auto" }}>
          Case management, evidence package linking, law firm share links, and the
          case status lifecycle (Open → Referred) will be enabled in Phase 2.
        </div>
      </div>
    </>
  );
}
