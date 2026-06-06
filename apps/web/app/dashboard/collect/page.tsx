"use client";
import { useState, useRef } from "react";
import Link from "next/link";

type JobStatus = "PENDING" | "RUNNING" | "DONE" | "FAILED";

interface JobState {
  jobId: string;
  status: JobStatus;
  totalVideos: number;
  processedVideos: number;
  totalComments: number;
  errorMessage: string | null;
}

function statusBadgeStyle(status: JobStatus): React.CSSProperties {
  switch (status) {
    case "PENDING": return { background: "var(--surface-2)", color: "var(--ink-3)" };
    case "RUNNING": return { background: "var(--info-bg)", color: "var(--info-ink)" };
    case "DONE":    return { background: "var(--ok-bg)",   color: "var(--ok-ink)" };
    case "FAILED":  return { background: "var(--crit-bg)", color: "var(--crit-ink)" };
  }
}

const STATUS_LABEL: Record<JobStatus, string> = {
  PENDING: "Pending",
  RUNNING: "Running",
  DONE:    "Done",
  FAILED:  "Failed",
};

export default function CollectPage() {
  const [channelInput, setChannelInput] = useState("");
  const [starting, setStarting] = useState(false);
  const [job, setJob] = useState<JobState | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function pollStatus(jobId: string) {
    try {
      const res = await fetch(`/api/collect/status/${jobId}`);
      if (!res.ok) return;
      const data = await res.json();
      setJob((prev) => ({
        jobId,
        status: data.status,
        totalVideos: data.totalVideos,
        processedVideos: data.processedVideos,
        totalComments: data.totalComments,
        errorMessage: data.errorMessage ?? null,
      }));
      if (data.status === "DONE" || data.status === "FAILED") stopPolling();
    } catch {
      // ignore transient poll errors
    }
  }

  async function handleStart() {
    const channelId = channelInput.trim();
    if (!channelId) return;

    stopPolling();
    setStarting(true);
    setStartError(null);
    setJob(null);

    try {
      const res = await fetch("/api/collect/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStartError(data.error ?? "Failed to start collection");
        return;
      }

      const jobId: string = data.jobId;
      setJob({ jobId, status: "PENDING", totalVideos: 0, processedVideos: 0, totalComments: 0, errorMessage: null });
      pollRef.current = setInterval(() => pollStatus(jobId), 3000);
    } catch (e) {
      setStartError(String(e));
    } finally {
      setStarting(false);
    }
  }

  const isActive = job?.status === "PENDING" || job?.status === "RUNNING";
  const progress =
    job && job.totalVideos > 0
      ? Math.round((job.processedVideos / job.totalVideos) * 100)
      : 0;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Collect Comments</h1>
          <div className="sub">Collect all comments from a YouTube channel and store them in the database.</div>
        </div>
      </div>

      {/* Input card */}
      <div className="card" style={{ maxWidth: 560, marginBottom: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label
              htmlFor="channel-input"
              style={{ display: "block", fontWeight: 600, fontSize: 13, color: "var(--ink-2)", marginBottom: 6 }}
            >
              Channel ID or URL
            </label>
            <input
              id="channel-input"
              type="text"
              placeholder="@channelname · UCxxxxxxxx · https://youtube.com/@..."
              value={channelInput}
              onChange={(e) => setChannelInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !starting && !isActive) handleStart(); }}
              disabled={starting || isActive}
              style={{
                width: "100%",
                padding: "9px 12px",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-md)",
                fontSize: 14,
                color: "var(--ink)",
                background: starting || isActive ? "var(--surface-2)" : "var(--surface)",
                outline: "none",
                fontFamily: "var(--font)",
              }}
            />
          </div>

          <button
            className="btn primary"
            onClick={handleStart}
            disabled={starting || isActive || !channelInput.trim()}
            style={{ alignSelf: "flex-start" }}
          >
            {starting ? "Starting…" : isActive ? "Collecting…" : "Start Collection"}
          </button>

          {startError && (
            <div style={{ fontSize: 13, color: "var(--crit-ink)", background: "var(--crit-bg)", borderRadius: "var(--r-md)", padding: "9px 12px" }}>
              {startError}
            </div>
          )}
        </div>
      </div>

      {/* Progress card */}
      {job && (
        <div className="card" style={{ maxWidth: 560 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Header row: title + status badge */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>Collection Job</span>
              <span
                className="badge"
                style={statusBadgeStyle(job.status)}
              >
                {STATUS_LABEL[job.status]}
              </span>
            </div>

            {/* Progress bar (visible while running or done with videos) */}
            {job.totalVideos > 0 && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--ink-3)", marginBottom: 5 }}>
                  <span>{job.processedVideos} / {job.totalVideos} videos processed</span>
                  <span>{progress}%</span>
                </div>
                <div style={{ height: 6, background: "var(--surface-3)", borderRadius: "var(--r-full)", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${progress}%`,
                      background: job.status === "FAILED" ? "var(--crit-ink)" : "var(--accent)",
                      borderRadius: "var(--r-full)",
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>
              </div>
            )}

            {/* Comment count */}
            <div style={{ fontSize: 13, color: "var(--ink-2)" }}>
              <span style={{ fontWeight: 700, fontSize: 22, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
                {job.totalComments.toLocaleString()}
              </span>
              {" "}
              <span>comments collected</span>
            </div>

            {/* Error message */}
            {job.status === "FAILED" && job.errorMessage && (
              <div style={{ fontSize: 13, color: "var(--crit-ink)", background: "var(--crit-bg)", borderRadius: "var(--r-md)", padding: "9px 12px" }}>
                {job.errorMessage}
              </div>
            )}

            {/* View comments CTA */}
            {job.status === "DONE" && (
              <Link
                href="/dashboard/comments"
                className="btn primary"
                style={{ textDecoration: "none", alignSelf: "flex-start" }}
              >
                View Comments
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
