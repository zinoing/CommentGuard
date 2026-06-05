"use client";
import { useState } from "react";

interface ActionApprovalPanelProps {
  commentId: string;
  userId: string;
  onApprove: (approvedById: string, actionType: string) => Promise<void>;
}

// CHECKLIST §3: CommentGuard only supports REQUEST_LEGAL_REVIEW.
// Operators perform platform hide/delete/block directly on the platform.
const ACTIONS = [
  { value: "REQUEST_LEGAL_REVIEW", label: "Request Legal Review (activates Legal Hold)" },
];

export function ActionApprovalPanel({ commentId, userId, onApprove }: ActionApprovalPanelProps) {
  const [selectedAction, setSelectedAction] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    if (!selectedAction || !userId) return;
    setLoading(true);
    setError(null);
    try {
      await onApprove(userId, selectedAction);
    } catch (err: any) {
      setError(err.message ?? "Action failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-canvas border border-divider-hairline rounded-[18px] p-5">
      <h3 className="text-[17px] font-semibold text-ink leading-[1.24] tracking-[-0.374px] mb-1">
        Select Action
      </h3>
      <p className="text-[12px] text-ink-48 tracking-[-0.12px] font-mono truncate mb-4">
        {commentId}
      </p>

      <div className="flex flex-col gap-3 mb-5">
        {ACTIONS.map((action) => (
          <label key={action.value} className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name={`action-${commentId}`}
              value={action.value}
              onChange={() => setSelectedAction(action.value)}
              className="accent-brand-blue w-4 h-4"
            />
            <span className="text-[17px] text-ink leading-[1.47] tracking-[-0.374px]">{action.label}</span>
          </label>
        ))}
      </div>

      <p className="text-[12px] text-ink-48 tracking-[-0.12px] mb-4 leading-[1.5]">
        Approval is recorded under your account. Platform actions cannot be automated.
      </p>

      {error && (
        <p className="text-[12px] text-risk-high tracking-[-0.12px] mb-3">{error}</p>
      )}

      <button
        onClick={handleApprove}
        disabled={!selectedAction || loading || !userId}
        className="w-full bg-brand-blue text-white text-[17px] leading-none tracking-[-0.374px] py-[11px] px-[22px] rounded-full hover:bg-brand-blue-focus active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        {loading ? "Approving…" : "Approve & Execute"}
      </button>
    </div>
  );
}
