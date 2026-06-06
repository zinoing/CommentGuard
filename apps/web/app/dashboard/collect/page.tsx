"use client";
import { useState, useEffect, useRef } from "react";

type JobStatus = "PENDING" | "RUNNING" | "DONE" | "FAILED";

interface CollectJob {
  jobId: string;
  status: JobStatus;
  totalVideos: number;
  processedVideos: number;
  totalComments: number;
  newComments: number;
  modifiedComments: number;
  deletedComments: number;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : "";
}

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (isToday) return "오늘";
  return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

const STATUS_LABEL: Record<JobStatus, string> = {
  PENDING: "대기 중",
  RUNNING: "수집 중",
  DONE: "완료",
  FAILED: "실패",
};

function StatusBadge({ status }: { status: JobStatus }) {
  const style: React.CSSProperties =
    status === "DONE"
      ? { background: "var(--ok-bg)", color: "var(--ok-ink)" }
      : status === "RUNNING" || status === "PENDING"
      ? { background: "var(--info-bg)", color: "var(--info-ink)" }
      : { background: "var(--crit-bg)", color: "var(--crit-ink)" };
  return <span className="badge" style={style}>{STATUS_LABEL[status]}</span>;
}

export default function CollectPage() {
  const [history, setHistory] = useState<CollectJob[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [activeJob, setActiveJob] = useState<CollectJob | null>(null);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminId, setAdminId] = useState("");
  const [adminPw, setAdminPw] = useState("");
  const [adminError, setAdminError] = useState("");
  const [starting, setStarting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  // Poll active job
  useEffect(() => {
    if (!activeJob || activeJob.status === "DONE" || activeJob.status === "FAILED") {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    if (pollRef.current) return; // already polling
    pollRef.current = setInterval(() => pollJob(activeJob.jobId), 3000);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [activeJob?.jobId, activeJob?.status]);

  async function fetchHistory() {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/collect/history");
      if (res.ok) setHistory(await res.json());
    } finally {
      setHistoryLoading(false);
    }
  }

  async function pollJob(jobId: string) {
    const res = await fetch(`/api/collect/status/${jobId}`).catch(() => null);
    if (!res?.ok) return;
    const data: CollectJob = await res.json();
    setActiveJob(data);
    if (data.status === "DONE" || data.status === "FAILED") {
      fetchHistory();
    }
  }

  function handleAdminSubmit() {
    if (adminId === "admin" && adminPw === "0000") {
      setShowAdminModal(false);
      setAdminId("");
      setAdminPw("");
      setAdminError("");
      triggerCollect();
    } else {
      setAdminError("ID 또는 비밀번호가 올바르지 않습니다.");
    }
  }

  async function triggerCollect() {
    const channelId = getCookie("cg_channel_id");
    if (!channelId) return;
    setStarting(true);
    try {
      const res = await fetch("/api/collect/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId }),
      });
      const data = await res.json();
      if (res.ok) {
        setActiveJob({
          jobId: data.jobId,
          status: "PENDING",
          totalVideos: 0,
          processedVideos: 0,
          totalComments: 0,
          newComments: 0,
          modifiedComments: 0,
          deletedComments: 0,
          errorMessage: null,
          startedAt: new Date().toISOString(),
          completedAt: null,
        });
      }
    } finally {
      setStarting(false);
    }
  }

  const isRunning = activeJob?.status === "PENDING" || activeJob?.status === "RUNNING";
  const progress =
    activeJob && activeJob.totalVideos > 0
      ? Math.round((activeJob.processedVideos / activeJob.totalVideos) * 100)
      : 0;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Collect</h1>
          <div className="sub">채널 댓글 수집 현황 및 이력</div>
        </div>
        <button
          className="btn primary"
          onClick={() => { setAdminError(""); setShowAdminModal(true); }}
          disabled={isRunning || starting}
        >
          수동 수집 실행
        </button>
      </div>

      {/* Active job progress */}
      {activeJob && (
        <div className="card" style={{ maxWidth: 560, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>진행 중인 수집</span>
            <StatusBadge status={activeJob.status} />
          </div>

          {activeJob.totalVideos > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--ink-3)", marginBottom: 5 }}>
                <span>{activeJob.processedVideos} / {activeJob.totalVideos} 영상</span>
                <span>{progress}%</span>
              </div>
              <div style={{ height: 6, background: "var(--surface-3)", borderRadius: "var(--r-full)", overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${progress}%`,
                  background: activeJob.status === "FAILED" ? "var(--crit-ink)" : "var(--accent)",
                  borderRadius: "var(--r-full)", transition: "width 0.4s ease",
                }} />
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 20, fontSize: 13, color: "var(--ink-2)" }}>
            <span><strong style={{ color: "var(--ink)" }}>{activeJob.newComments.toLocaleString()}</strong> 신규</span>
            <span><strong style={{ color: "var(--ink)" }}>{activeJob.modifiedComments.toLocaleString()}</strong> 수정됨</span>
            <span><strong style={{ color: "var(--ink)" }}>{activeJob.deletedComments.toLocaleString()}</strong> 삭제됨</span>
          </div>

          {activeJob.status === "FAILED" && activeJob.errorMessage && (
            <div style={{ marginTop: 10, fontSize: 13, color: "var(--crit-ink)", background: "var(--crit-bg)", borderRadius: "var(--r-md)", padding: "9px 12px" }}>
              {activeJob.errorMessage}
            </div>
          )}
        </div>
      )}

      {/* History log */}
      <div className="card">
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>수집 히스토리</div>

        {historyLoading ? (
          <div className="muted" style={{ fontSize: 13 }}>로딩 중…</div>
        ) : history.length === 0 ? (
          <div className="muted" style={{ fontSize: 13 }}>수집 이력이 없습니다.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {history.map((job, i) => (
              <div
                key={job.jobId}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 16,
                  padding: "14px 0",
                  borderBottom: i < history.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                {/* Date + time */}
                <div style={{ minWidth: 100, flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                    {fmtDate(job.startedAt)} {fmt(job.startedAt)}
                  </div>
                  {job.completedAt && (
                    <div className="muted" style={{ fontSize: 12 }}>
                      → {fmt(job.completedAt)} 완료
                    </div>
                  )}
                </div>

                {/* Counters */}
                <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: "4px 20px", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "var(--ink-2)" }}>
                    <span style={{ color: "var(--ok-ink)", fontWeight: 600 }}>+{job.newComments}</span> 신규
                  </span>
                  <span style={{ fontSize: 13, color: "var(--ink-2)" }}>
                    <span style={{ color: "var(--ink)", fontWeight: 600 }}>+{job.modifiedComments}</span> 수정됨
                  </span>
                  <span style={{ fontSize: 13, color: "var(--ink-2)" }}>
                    <span style={{ color: "var(--crit-ink)", fontWeight: 600 }}>-{job.deletedComments}</span> 삭제됨
                  </span>
                  {job.status === "RUNNING" || job.status === "PENDING" ? (
                    <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
                      ({job.processedVideos}/{job.totalVideos} 영상)
                    </span>
                  ) : null}
                </div>

                <StatusBadge status={job.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Admin modal */}
      {showAdminModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
        }}>
          <div className="card" style={{ width: 360, maxWidth: "calc(100vw - 32px)" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>관리자 인증</div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 20 }}>
              수동 수집을 실행하려면 관리자 계정이 필요합니다.
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              <input
                type="text"
                placeholder="아이디"
                value={adminId}
                onChange={(e) => setAdminId(e.target.value)}
                autoFocus
                style={{
                  padding: "9px 12px", border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)", fontSize: 14,
                }}
              />
              <input
                type="password"
                placeholder="비밀번호"
                value={adminPw}
                onChange={(e) => setAdminPw(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAdminSubmit(); }}
                style={{
                  padding: "9px 12px", border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)", fontSize: 14,
                }}
              />
            </div>

            {adminError && (
              <div style={{
                fontSize: 13, color: "var(--crit-ink)", background: "var(--crit-bg)",
                borderRadius: "var(--r-md)", padding: "9px 12px", marginBottom: 12,
              }}>
                {adminError}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => {
                setShowAdminModal(false);
                setAdminId(""); setAdminPw(""); setAdminError("");
              }}>
                취소
              </button>
              <button className="btn primary" onClick={handleAdminSubmit}>
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
