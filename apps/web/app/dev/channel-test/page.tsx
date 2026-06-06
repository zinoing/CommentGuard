// DEV ONLY — remove before GA
"use client";
import React, { useState } from "react";

type Status = "idle" | "loading" | "done" | "error";

interface DevComment {
  comment_id: string;
  video_id: string;
  parent: string;
  text: string;
  author_id: string;
  created_at: string;
  legal_score: null;
  brand_score: null;
  urgency_score: null;
  risk_types: string[];
  recommended_action: null;
  classification: "reference_only";
}

interface CollectResult {
  channel_id: string;
  video_id: string;
  collected_at: string;
  comments: DevComment[];
}

export default function ChannelTestPage() {
  const [channelInput, setChannelInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<CollectResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  async function handleLoad() {
    const trimmed = channelInput.trim();
    if (!trimmed) return;

    setStatus("loading");
    setError(null);
    setResult(null);
    setExpanded(new Set());

    try {
      const res = await fetch("/api/dev/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      setResult(data as CollectResult);
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: "0 auto" }}>
      <div className="page-head">
        <div>
          <h1>
            Channel Test
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: "var(--ink-3)",
                marginLeft: 10,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              dev only
            </span>
          </h1>
          <div className="muted">
            yt-dlp 수집 테스트 — 인증 없음, 저장 없음, 분류 없음
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div
          className="cg-row ac g16"
          style={{ padding: "16px 16px 12px" }}
        >
          <input
            className="cg-input"
            style={{ flex: 1 }}
            placeholder="https://www.youtube.com/@channelname  or  UCxxxxxxxx"
            value={channelInput}
            onChange={(e) => setChannelInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLoad()}
          />
          <button
            className="btn primary"
            onClick={handleLoad}
            disabled={status === "loading"}
          >
            {status === "loading" ? "Loading…" : "Load Comments"}
          </button>
        </div>

        <div style={{ padding: "0 16px 16px", fontSize: 13 }}>
          {status === "idle" && (
            <span className="muted">
              채널 URL 또는 ID를 입력 후 버튼을 누르세요.
            </span>
          )}
          {status === "loading" && (
            <span style={{ color: "var(--ink-3)" }}>
              yt-dlp로 수집 중… (최대 60초 소요)
            </span>
          )}
          {status === "error" && (
            <span style={{ color: "#e53e3e" }}>오류: {error}</span>
          )}
          {status === "done" && result && (
            <span style={{ color: "#38a169" }}>
              수집 완료 — {result.comments.filter(c => (c.parent ?? "root") === "root").length}개 댓글 ·{" "}
              {result.comments.filter(c => (c.parent ?? "root") !== "root").length}개 대댓글 ·{" "}
              <span className="muted">{result.channel_id}</span>
            </span>
          )}
        </div>
      </div>

      {result && result.comments.length > 0 && (
        <div className="card" style={{ marginTop: 16, padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
              }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["comment_id", "text (50자)", "author_id", "created_at", ""].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          padding: "10px 14px",
                          textAlign: h === "" ? "right" : "left",
                          color: "var(--ink-3)",
                          fontWeight: 500,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {result.comments.map((c) => {
                  const isReply = (c.parent ?? "root") !== "root";
                  return (
                  <React.Fragment key={c.comment_id}>
                    <tr
                      style={{
                        borderBottom: "1px solid var(--border)",
                        background: isReply ? "var(--bg)" : undefined,
                      }}
                    >
                      <td style={{ padding: "10px 14px", paddingLeft: isReply ? 28 : 14 }}>
                        {isReply && (
                          <span style={{ color: "var(--ink-3)", marginRight: 6, fontSize: 11 }}>↳</span>
                        )}
                        <span className="cg-mono" style={{ fontSize: 11 }}>
                          {c.comment_id.slice(-12)}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "10px 14px",
                          paddingLeft: isReply ? 28 : 14,
                          maxWidth: 320,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {c.text.slice(0, 50)}
                        {c.text.length > 50 && "…"}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span className="muted">{c.author_id}</span>
                      </td>
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                        <span className="muted" style={{ fontSize: 12 }}>
                          {new Date(c.created_at).toLocaleString("ko-KR")}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right" }}>
                        <button
                          className="btn sm ghost"
                          onClick={() => toggleExpand(c.comment_id)}
                          style={{ fontSize: 11 }}
                        >
                          {expanded.has(c.comment_id) ? "접기" : "펼치기"}
                        </button>
                      </td>
                    </tr>
                    {expanded.has(c.comment_id) && (
                      <tr>
                        <td
                          colSpan={5}
                          style={{
                            padding: "12px 16px",
                            background: "var(--bg)",
                            borderBottom: "1px solid var(--border)",
                          }}
                        >
                          <pre
                            className="cg-mono"
                            style={{
                              fontSize: 11,
                              margin: 0,
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-all",
                            }}
                          >
                            {JSON.stringify(c, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result && result.comments.length === 0 && (
        <div className="card" style={{ marginTop: 16, padding: 24, textAlign: "center" }}>
          <span className="muted">수집된 댓글이 없습니다.</span>
        </div>
      )}
    </div>
  );
}
