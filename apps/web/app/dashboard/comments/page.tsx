import { RiskBadge } from "@/components/RiskBadge";

export default function CommentsPage() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Comments</h1>
        <span className="text-xs text-gray-400 bg-yellow-50 border border-yellow-200 px-3 py-1 rounded-full">
          All scores are for reference only — not legal determinations
        </span>
      </div>
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100 grid grid-cols-5 text-xs font-medium text-gray-500 uppercase tracking-wide">
          <span className="col-span-2">Comment</span>
          <span>Legal Score</span>
          <span>Risk Types</span>
          <span>Action</span>
        </div>
        <div className="divide-y divide-gray-50">
          <p className="px-6 py-8 text-center text-gray-400 text-sm">
            No comments collected yet. Configure a channel to start monitoring.
          </p>
        </div>
      </div>
    </div>
  );
}
