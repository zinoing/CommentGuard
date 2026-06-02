"use client";
import { useState } from "react";

interface ActionApprovalPanelProps {
  commentId: string;
  onApprove: (approvedById: string, actionType: string) => Promise<void>;
}

export function ActionApprovalPanel({ commentId, onApprove }: ActionApprovalPanelProps) {
  const [selectedAction, setSelectedAction] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const actions = [
    { value: "IGNORE", label: "Ignore" },
    { value: "HIDE", label: "Hide from public" },
    { value: "DELETE", label: "Delete" },
    { value: "PRESERVE_AND_DELETE", label: "Preserve as evidence & Delete" },
  ];

  async function handleApprove() {
    if (!selectedAction) return;
    setLoading(true);
    try {
      // approvedById comes from the authenticated session (real user ID)
      const session = { userId: "current-user-id" }; // placeholder
      await onApprove(session.userId, selectedAction);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <h3 className="text-sm font-medium text-gray-900 mb-3">Select Action</h3>
      <div className="flex flex-col gap-2 mb-4">
        {actions.map((action) => (
          <label key={action.value} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={`action-${commentId}`}
              value={action.value}
              onChange={() => setSelectedAction(action.value)}
              className="text-brand-blue"
            />
            <span className="text-sm text-gray-700">{action.label}</span>
          </label>
        ))}
      </div>
      <p className="text-xs text-gray-400 mb-3">
        Approval requires authenticated user authorization. Platform actions cannot be automated.
      </p>
      <button
        onClick={handleApprove}
        disabled={!selectedAction || loading}
        className="w-full bg-brand-blue text-white py-2 px-4 rounded-full text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-blue-dark transition-colors"
      >
        {loading ? "Approving..." : "Approve & Execute"}
      </button>
    </div>
  );
}
