"use client";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface Stats {
  totalComments: number;
  highRiskCount: number;
  riskTypeCounts: Record<string, number>;
  trend: { date: string; count: number }[];
}

function fetcher(url: string, token: string) {
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
}

const BFF = process.env.NEXT_PUBLIC_BFF_URL ?? "http://localhost:3001";

export default function DashboardPage() {
  const { data: session } = useSession();
  const token = (session as any)?.bffToken ?? "";

  const { data: stats, isLoading } = useSWR<Stats>(
    token ? [`${BFF}/api/v1/dashboard/stats`, token] : null,
    ([url, t]) => fetcher(url, t),
    { refreshInterval: 30_000 }
  );

  if (isLoading || !stats) {
    return <div className="p-8 text-[14px] text-ink-48 tracking-[-0.224px]">Loading stats…</div>;
  }

  const riskTypeRows = Object.entries(stats.riskTypeCounts).sort(([, a], [, b]) => b - a);

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-semibold text-ink text-[34px] leading-[1.47] tracking-[-0.374px]">
          Overview
        </h1>
        <span className="text-[12px] text-ink-48 bg-canvas border border-divider-hairline px-3 py-1 rounded-full tracking-[-0.12px]">
          Reference only — not legal determinations
        </span>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-5">
        <StatCard label="Total Comments" value={stats.totalComments} />
        <StatCard label="High Risk (≥0.7)" value={stats.highRiskCount} highlight />
      </div>

      {/* 7-day trend */}
      <div className="bg-canvas rounded-[18px] border border-divider-hairline p-6">
        <h2 className="text-[17px] font-semibold text-ink leading-[1.24] tracking-[-0.374px] mb-5">
          7-Day Comment Volume
        </h2>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={stats.trend} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#7a7a7a" }} />
            <YAxis tick={{ fontSize: 11, fill: "#7a7a7a" }} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#ffffff",
                border: "1px solid #e0e0e0",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Bar dataKey="count" fill="#0066cc" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Risk type distribution */}
      {riskTypeRows.length > 0 && (
        <div className="bg-canvas rounded-[18px] border border-divider-hairline p-6">
          <h2 className="text-[17px] font-semibold text-ink leading-[1.24] tracking-[-0.374px] mb-4">
            Risk Type Distribution
          </h2>
          <div className="divide-y divide-divider-soft">
            {riskTypeRows.map(([type, count]) => (
              <div key={type} className="flex items-center justify-between py-3">
                <span className="text-[17px] text-ink-48 leading-[1.47] tracking-[-0.374px]">
                  {type.replace(/_/g, " ")}
                </span>
                <span className="text-[17px] font-semibold text-ink leading-[1.24] tracking-[-0.374px]">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="bg-canvas rounded-[18px] border border-divider-hairline p-6">
      <p className="text-[14px] text-ink-48 leading-[1.43] tracking-[-0.224px] mb-3">{label}</p>
      <p className={`text-[40px] font-semibold leading-[1.1] ${highlight ? "text-risk-high" : "text-ink"}`}>
        {value}
      </p>
    </div>
  );
}
