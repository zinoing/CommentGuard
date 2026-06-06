"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface Channel {
  id: string;
  name: string;
  platformChannelId: string;
  platform: string;
  lastCollectedAt: string | null;
}

interface CollectJob {
  jobId: string;
  channelId: string;
  status: "PENDING" | "RUNNING" | "DONE" | "FAILED";
  totalVideos: number;
  processedVideos: number;
  totalComments: number;
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; SameSite=Lax`;
}

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : "";
}

export default function SetupPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteChannelName, setInviteChannelName] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  const [showDevModal, setShowDevModal] = useState(false);
  const [devUrl, setDevUrl] = useState("");
  const [devLoading, setDevLoading] = useState(false);
  const [devError, setDevError] = useState<string | null>(null);
  const [activeJobs, setActiveJobs] = useState<Record<string, CollectJob>>({});

  const isDevUser =
    process.env.NODE_ENV === "development" &&
    session?.user?.email === "zinolubjosee@gmail.com";

  useEffect(() => {
    fetchChannels();
  }, []);

  // Poll active jobs
  useEffect(() => {
    const ids = Object.keys(activeJobs).filter(
      (id) => activeJobs[id].status === "PENDING" || activeJobs[id].status === "RUNNING"
    );
    if (ids.length === 0) return;
    const interval = setInterval(async () => {
      for (const jobId of ids) {
        const res = await fetch(`/api/collect/status/${jobId}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        }).catch(() => null);
        if (!res?.ok) continue;
        const data = await res.json();
        setActiveJobs((prev) => ({ ...prev, [jobId]: data }));
        if (data.status === "DONE" || data.status === "FAILED") {
          await fetchChannels();
        }
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [activeJobs]);

  async function fetchChannels() {
    setLoading(true);
    try {
      const res = await fetch("/api/channels");
      if (res.ok) setChannels(await res.json());
    } finally {
      setLoading(false);
    }
  }

  function selectChannel(channel: Channel) {
    setCookie("cg_channel_id", channel.id);
    setCookie("cg_channel_name", channel.name);
    router.push("/dashboard");
  }

  async function handleInviteCreate() {
    if (!inviteChannelName.trim()) return;
    setInviteLoading(true);
    try {
      const res = await fetch("/api/channels/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelName: inviteChannelName }),
      });
      const data = await res.json();
      if (res.ok) setInviteLink(data.inviteUrl);
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleDevRegister() {
    if (!devUrl.trim()) return;
    setDevLoading(true);
    setDevError(null);
    try {
      const res = await fetch("/api/dev/channel-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelUrl: devUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDevError(data.error ?? "등록 실패");
        return;
      }
      setShowDevModal(false);
      setDevUrl("");
      setActiveJobs((prev) => ({
        ...prev,
        [data.jobId]: {
          jobId: data.jobId,
          channelId: data.channelId,
          status: "RUNNING",
          totalVideos: 0,
          processedVideos: 0,
          totalComments: 0,
        },
      }));
      await fetchChannels();
    } finally {
      setDevLoading(false);
    }
  }

  return (
    <>
    <style>{`@keyframes cg-spin { to { transform: rotate(360deg); } }`}</style>
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "48px 24px",
    }}>
      <div style={{ width: "100%", maxWidth: 640 }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 16 }}>
            <div className="shield" />
            <span style={{ fontWeight: 700, fontSize: 20 }}>CommentGuard</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>채널 선택</h1>
          <p className="muted">분석할 YouTube 채널을 선택하거나 등록하세요.</p>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginBottom: 16 }}>
          {isDevUser && (
            <button
              className="btn"
              onClick={() => { setShowDevModal(true); setDevError(null); }}
            >
              [DEV] URL로 직접 등록
            </button>
          )}
          <button className="btn primary" onClick={() => setShowInviteModal(true)}>
            채널 추가
          </button>
        </div>

        {/* Channel list */}
        {loading ? (
          <div className="muted" style={{ textAlign: "center", padding: 40 }}>로딩 중…</div>
        ) : channels.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 48 }}>
            <div className="muted" style={{ marginBottom: 16 }}>등록된 채널이 없습니다.</div>
            <button className="btn primary" onClick={() => setShowInviteModal(true)}>
              채널 등록
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {channels.map((ch) => {
              const job = Object.values(activeJobs).find((j) => (j as any).channelId === ch.id) ?? null;
              const isRunning = job && (job.status === "PENDING" || job.status === "RUNNING");
              const isDone = job?.status === "DONE";
              const isFailed = job?.status === "FAILED";
              const displayName = ch.name && ch.name !== "NA" ? ch.name : ch.platformChannelId;
              const progress = job && job.totalVideos > 0
                ? Math.round((job.processedVideos / job.totalVideos) * 100)
                : 0;

              return (
                <div
                  key={ch.id}
                  className="card"
                  style={{ cursor: isRunning ? "default" : "pointer" }}
                  onClick={() => !isRunning && selectChannel(ch)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: "50%",
                      background: "var(--accent)", color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 700, fontSize: 16, flexShrink: 0,
                    }}>
                      {displayName[0]?.toUpperCase() ?? "C"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>{displayName}</div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {ch.platformChannelId}
                        {ch.lastCollectedAt && (
                          <> · 마지막 수집: {new Date(ch.lastCollectedAt).toLocaleDateString("ko-KR")}</>
                        )}
                      </div>
                      {isRunning && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontSize: 12, color: "var(--info-ink)", marginBottom: 4 }}>
                            초기 수집 중…
                            {job.totalVideos > 0 && ` (${job.processedVideos}/${job.totalVideos} 영상)`}
                          </div>
                          {job.totalVideos === 0 ? (
                            <div style={{
                              width: 14, height: 14, borderRadius: "50%",
                              border: "2px solid var(--surface-3)",
                              borderTopColor: "var(--accent)",
                              animation: "cg-spin 0.8s linear infinite",
                            }} />
                          ) : (
                            <div style={{ height: 4, background: "var(--surface-3)", borderRadius: "var(--r-full)", overflow: "hidden" }}>
                              <div style={{
                                height: "100%", width: `${progress}%`,
                                background: "var(--accent)", borderRadius: "var(--r-full)",
                                transition: "width 0.4s ease",
                              }} />
                            </div>
                          )}
                        </div>
                      )}
                      {isDone && (
                        <div style={{ marginTop: 4, fontSize: 12, color: "var(--ok-ink, #16a34a)" }}>
                          수집 완료
                        </div>
                      )}
                      {isFailed && (
                        <div style={{ marginTop: 4, fontSize: 12, color: "var(--crit-ink)" }}>
                          수집 오류 — 재시도 필요
                        </div>
                      )}
                    </div>
                    {!isRunning && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 초대 모달 */}
      {showInviteModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
        }}>
          <div className="card" style={{ width: 440, maxWidth: "calc(100vw - 32px)" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>크리에이터 초대</div>
            {!inviteLink ? (
              <>
                <label style={{ display: "block", fontSize: 13, color: "var(--ink-2)", marginBottom: 6 }}>채널명</label>
                <input
                  type="text"
                  placeholder="예: 침착맨"
                  value={inviteChannelName}
                  onChange={(e) => setInviteChannelName(e.target.value)}
                  style={{
                    width: "100%", padding: "9px 12px", border: "1px solid var(--border)",
                    borderRadius: "var(--r-md)", fontSize: 14, marginBottom: 16, boxSizing: "border-box",
                  }}
                />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button className="btn" onClick={() => { setShowInviteModal(false); setInviteChannelName(""); }}>취소</button>
                  <button className="btn primary" onClick={handleInviteCreate} disabled={inviteLoading || !inviteChannelName.trim()}>
                    {inviteLoading ? "생성 중…" : "초대 링크 생성"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 8 }}>이 링크를 크리에이터에게 전달하세요 (7일 후 만료)</div>
                <div style={{
                  background: "var(--surface-2)", borderRadius: "var(--r-md)",
                  padding: "10px 12px", fontSize: 13, wordBreak: "break-all", marginBottom: 12,
                }}>
                  {inviteLink}
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button className="btn" onClick={() => navigator.clipboard.writeText(inviteLink)}>복사</button>
                  <button className="btn primary" onClick={() => { setShowInviteModal(false); setInviteLink(null); setInviteChannelName(""); }}>완료</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* DEV 모달 */}
      {showDevModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
        }}>
          <div className="card" style={{ width: 480, maxWidth: "calc(100vw - 32px)" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>[DEV] URL로 채널 직접 등록</div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 16 }}>
              yt-dlp로 최근 {process.env.DEV_MAX_VIDEOS ?? 3}개 영상 댓글을 수집합니다.
            </div>
            <label style={{ display: "block", fontSize: 13, color: "var(--ink-2)", marginBottom: 6 }}>YouTube 채널 URL</label>
            <input
              type="text"
              placeholder="https://www.youtube.com/@handle 또는 UCxxxxxxxx"
              value={devUrl}
              onChange={(e) => setDevUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !devLoading) handleDevRegister(); }}
              style={{
                width: "100%", padding: "9px 12px", border: "1px solid var(--border)",
                borderRadius: "var(--r-md)", fontSize: 14, marginBottom: 12, boxSizing: "border-box",
              }}
            />
            {devError && (
              <div style={{
                fontSize: 13, color: "var(--crit-ink)", background: "var(--crit-bg)",
                borderRadius: "var(--r-md)", padding: "9px 12px", marginBottom: 12,
              }}>
                {devError}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => { setShowDevModal(false); setDevUrl(""); setDevError(null); }}>취소</button>
              <button className="btn primary" onClick={handleDevRegister} disabled={devLoading || !devUrl.trim()}>
                {devLoading ? "등록 중…" : "등록 및 수집 시작"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
