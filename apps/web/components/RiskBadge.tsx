interface RiskBadgeProps {
  score: number;
  label?: string;
}

export function RiskBadge({ score, label }: RiskBadgeProps) {
  const level = score >= 0.7 ? "high" : score >= 0.4 ? "medium" : "low";
  const styles = {
    high: "bg-red-50 text-risk-high border-red-200",
    medium: "bg-yellow-50 text-yellow-700 border-yellow-200",
    low: "bg-green-50 text-risk-low border-green-200",
  };

  return (
    <div className="flex flex-col gap-1">
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium border tracking-[-0.12px] ${styles[level]}`}
      >
        {label ?? `${(score * 100).toFixed(0)}%`}
      </span>
      <span className="text-[10px] text-ink-48 tracking-tight">ref. only</span>
    </div>
  );
}
