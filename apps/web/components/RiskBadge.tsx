interface RiskBadgeProps {
  score: number;
  label?: string;
}

// CHECKLIST §3: always display "Reference Only" label alongside risk scores
export function RiskBadge({ score, label }: RiskBadgeProps) {
  const level = score >= 0.7 ? "high" : score >= 0.4 ? "medium" : "low";
  const colors = {
    high: "bg-red-100 text-red-700 border-red-200",
    medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
    low: "bg-green-100 text-green-700 border-green-200",
  };

  return (
    <div className="flex flex-col gap-1">
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colors[level]}`}>
        {label ?? `${(score * 100).toFixed(0)}%`}
      </span>
      <span className="text-xs text-gray-400">reference only</span>
    </div>
  );
}
