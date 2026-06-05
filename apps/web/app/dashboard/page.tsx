"use client";
import Link from "next/link";
import useSWR from "swr";
import { useSession } from "next-auth/react";

interface Stats {
  totalComments: number;
  highRiskCount: number;
  riskTypeCounts: Record<string, number>;
  trend: { date: string; count: number }[];
}

const BFF = process.env.NEXT_PUBLIC_BFF_URL ?? "http://localhost:3001";

function fetcher(url: string, token: string) {
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
}

const RISK_COLORS = [
  "var(--crit-ink)",
  "var(--high-ink)",
  "var(--med-ink)",
  "var(--info-ink)",
  "var(--low-ink)",
];

const RISK_LABELS = [
  "Threats / Hate speech",
  "Harassment",
  "Defamation",
  "Advertiser risk",
  "Spam / Other",
];

export default function DashboardPage() {
  const { data: session } = useSession();
  const token = (session as any)?.bffToken ?? "";

  const { data: stats } = useSWR<Stats>(
    token ? `${BFF}/api/v1/dashboard/stats` : null,
    (url: string) => fetcher(url, token),
    { refreshInterval: 30_000 }
  );

  const totalFlagged = stats?.totalComments ?? 1284;
  const highCrit = stats?.highRiskCount ?? 47;

  const riskTypes = stats?.riskTypeCounts
    ? Object.entries(stats.riskTypeCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
    : null;

  const total = riskTypes ? riskTypes.reduce((s, [, v]) => s + v, 0) : totalFlagged;

  return (
    <>
      <div className="disclaimer">
        <span className="di">⚠</span>
        <span>
          Comments are flagged via periodic public scans. Legal evidence is collected only via official platform APIs.
          Last scan: Jun 3, 11:00 PM · Daily cadence.
        </span>
      </div>

      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <div className="sub">MCN-wide risk overview across 48 channels</div>
        </div>
        <div className="actions">
          <button className="btn">
            <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="cgrid g-kpi" style={{ marginBottom: 16 }}>
        <div className="kpi">
          <div className="lab">Flagged for review</div>
          <div className="num tabnums">{totalFlagged.toLocaleString()}</div>
          <div className="delta">across 312 posts</div>
        </div>
        <div className="kpi flag-high">
          <div className="lab">
            <span className="dotmark" style={{ background: "var(--high-ink)" }} />
            High + Critical
          </div>
          <div className="num tabnums">{highCrit.toLocaleString()}</div>
          <div className="delta up">▲ 8 vs yesterday</div>
        </div>
        <div className="kpi">
          <div className="lab">Avg. time to review</div>
          <div className="num tabnums">2h 34m</div>
          <div className="delta down">▼ 12m faster</div>
        </div>
        <div className="kpi flag-crit">
          <div className="lab">
            <span className="dotmark" style={{ background: "var(--crit-ink)" }} />
            Pending &gt; 24h
          </div>
          <div className="num tabnums">12</div>
          <div className="delta up">needs attention</div>
        </div>
      </div>

      {/* 2-column grid */}
      <div className="cgrid g-2">
        {/* Donut chart */}
        <div className="card">
          <div className="cg-row jb ac" style={{ marginBottom: 18 }}>
            <div className="eyebrow">Risk type distribution</div>
            <span className="badge neutral">Last 7 days</span>
          </div>
          <div className="donut-wrap">
            <div className="donut" style={riskTypes ? {
              background: buildDonutGradient(riskTypes.map(([, v]) => v)),
            } : {}}>
              <div className="mid">
                <div className="n tabnums">{totalFlagged.toLocaleString()}</div>
                <div className="t">Flagged</div>
              </div>
            </div>
            <div className="legend">
              {(riskTypes
                ? riskTypes.map(([label, count], i) => ({
                    label: label.replace(/_/g, " "),
                    pct: Math.round((count / total) * 100) + "%",
                    color: RISK_COLORS[i] ?? "var(--ink-3)",
                  }))
                : RISK_LABELS.map((label, i) => ({
                    label,
                    pct: ["18%", "24%", "24%", "18%", "16%"][i],
                    color: RISK_COLORS[i],
                  }))
              ).map(({ label, pct, color }) => (
                <div className="row" key={label}>
                  <span className="sw" style={{ background: color }} />
                  <span className="nm">{label}</span>
                  <span className="vl">{pct}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent critical flags */}
        <div className="card pad0">
          <div className="card-head">
            <h3>Recent critical flags</h3>
            <Link href="/dashboard/queue" className="cg-link" style={{ fontSize: 13 }}>Open Risk Queue →</Link>
          </div>
          <div className="tbl-wrap">
            <table className="tbl" style={{ minWidth: "auto" }}>
              <thead>
                <tr>
                  <th>Channel</th>
                  <th>Comment</th>
                  <th>Risk</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="cg-strong">Global News Network</td>
                  <td className="muted cg-small">&ldquo;This is completely fabricated and…&rdquo;</td>
                  <td><span className="badge crit"><span className="dot" />Critical</span></td>
                  <td className="cg-mono">0.98</td>
                </tr>
                <tr>
                  <td className="cg-strong">Civic Discourse</td>
                  <td className="muted cg-small">&ldquo;You people should be…&rdquo;</td>
                  <td><span className="badge crit"><span className="dot" />Critical</span></td>
                  <td className="cg-mono">0.97</td>
                </tr>
                <tr>
                  <td className="cg-strong">Tech Horizon</td>
                  <td className="muted cg-small">&ldquo;Misleading sponsored claim about…&rdquo;</td>
                  <td><span className="badge high"><span className="dot" />High</span></td>
                  <td className="cg-mono">0.91</td>
                </tr>
                <tr>
                  <td className="cg-strong">Finance Daily</td>
                  <td className="muted cg-small">&ldquo;Defamatory accusation regarding…&rdquo;</td>
                  <td><span className="badge high"><span className="dot" />High</span></td>
                  <td className="cg-mono">0.88</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

function buildDonutGradient(values: number[]): string {
  const total = values.reduce((s, v) => s + v, 0);
  if (total === 0) return "";
  let pct = 0;
  return (
    "conic-gradient(" +
    values
      .map((v, i) => {
        const start = pct;
        pct += (v / total) * 100;
        return `${RISK_COLORS[i] ?? "var(--ink-3)"} ${start}% ${pct}%`;
      })
      .join(", ") +
    ")"
  );
}
