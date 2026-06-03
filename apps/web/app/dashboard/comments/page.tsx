"use client";
import { useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { RiskBadge } from "@/components/RiskBadge";
import { ActionApprovalPanel } from "@/components/ActionApprovalPanel";

interface RiskAssessment {
  legalScore: number;
  brandScore: number;
  urgencyScore: number;
  recommendedAction: string;
  riskTypes: string[];
  modelVersion: string;
  classification: "reference_only";
  isProvisional: boolean;
}

interface Comment {
  id: string;
  channelId: string;
  createdAt: string;
  riskAssessment: RiskAssessment | null;
}

const BFF = process.env.NEXT_PUBLIC_BFF_URL ?? "http://localhost:3001";

function fetcher(url: string, token: string) {
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
}

export default function CommentsPage() {
  const { data: session } = useSession();
  const token = (session as any)?.bffToken ?? "";
  const userId = (session as any)?.userId ?? "";

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: comments = [], isLoading, mutate } = useSWR<Comment[]>(
    token ? [`${BFF}/api/v1/comments`, token] : null,
    ([url, t]) => fetcher(url, t),
    { refreshInterval: 60_000 }
  );

  async function handleApprove(approvedById: string, actionType: string) {
    const createRes = await fetch(`${BFF}/api/v1/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ commentId: selectedId, actionType }),
    });
    if (!createRes.ok) throw new Error("Failed to create action");
    const action = await createRes.json();

    const approveRes = await fetch(`${BFF}/api/v1/actions/${action.id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ approvedById }),
    });
    if (!approveRes.ok) throw new Error("Failed to approve action");

    setSelectedId(null);
    mutate();
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-semibold text-ink text-[34px] leading-[1.47] tracking-[-0.374px]">
          Comments
        </h1>
        <span className="text-[12px] text-ink-48 bg-canvas border border-divider-hairline px-3 py-1 rounded-full tracking-[-0.12px]">
          Reference only — not legal determinations
        </span>
      </div>

      <div className="flex gap-5">
        {/* Comment list */}
        <div className="flex-1 bg-canvas rounded-[18px] border border-divider-hairline overflow-hidden">
          {/* Table header */}
          <div className="px-6 py-3 border-b border-divider-hairline grid grid-cols-5 text-[12px] font-semibold text-ink-48 tracking-[-0.12px] uppercase">
            <span className="col-span-2">Comment ID</span>
            <span>Legal Score</span>
            <span>Risk Types</span>
            <span>Action</span>
          </div>

          {isLoading && (
            <p className="px-6 py-10 text-center text-[14px] text-ink-48 tracking-[-0.224px]">Loading…</p>
          )}

          {!isLoading && comments.length === 0 && (
            <p className="px-6 py-10 text-center text-[14px] text-ink-48 tracking-[-0.224px]">
              No comments collected yet. Configure a channel to start monitoring.
            </p>
          )}

          <div className="divide-y divide-divider-soft">
            {comments.map((c) => {
              const ra = c.riskAssessment;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id === selectedId ? null : c.id)}
                  className={`w-full px-6 py-4 grid grid-cols-5 items-center text-left transition-colors ${
                    selectedId === c.id ? "bg-[#f0f6ff]" : "hover:bg-canvas-parchment"
                  }`}
                >
                  <span className="col-span-2 font-mono text-[12px] text-ink-48 truncate">{c.id}</span>
                  <span>
                    {ra ? (
                      <RiskBadge score={ra.legalScore} />
                    ) : (
                      <span className="text-[12px] text-ink-48">pending</span>
                    )}
                  </span>
                  <span className="text-[14px] text-ink-48 tracking-[-0.224px] truncate">
                    {ra?.riskTypes.map((t) => t.replace(/_/g, " ")).join(", ") ?? "—"}
                  </span>
                  <span className="text-[14px] text-brand-blue tracking-[-0.224px]">
                    {selectedId === c.id ? "▲ Close" : "▼ Actions"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail / action panel */}
        {selectedId && (
          <div className="w-72 flex-shrink-0">
            <ActionApprovalPanel
              commentId={selectedId}
              userId={userId}
              onApprove={handleApprove}
            />
          </div>
        )}
      </div>
    </div>
  );
}
