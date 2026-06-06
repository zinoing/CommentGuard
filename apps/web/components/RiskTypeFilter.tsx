"use client";
import { useState, useRef, useEffect } from "react";

export const FILTER_TYPES = [
  "Defamation",
  "Threat",
  "Persistent Harassment",
  "Organized Attack",
  "Advertiser Risk",
] as const;

export type FilterType = (typeof FILTER_TYPES)[number];

export const RISK_TYPE_STYLES: Record<string, { bg: string; color: string }> = {
  "Defamation – False Facts": { bg: "#FFEDD5", color: "#C2410C" },
  "Defamation – True Facts":  { bg: "#FEF3C7", color: "#B45309" },
  "Threat":                   { bg: "#FEE2E2", color: "#B91C1C" },
  "Persistent Harassment":    { bg: "#F3E8FF", color: "#7E22CE" },
  "Organized Attack":         { bg: "#DBEAFE", color: "#1D4ED8" },
  "Advertiser Risk":          { bg: "#DCFCE7", color: "#15803D" },
};

export function riskTypeMatchesFilter(riskTypes: string[], selected: Set<string>): boolean {
  if (selected.size === FILTER_TYPES.length) return true;
  return riskTypes.some((rt) => {
    if (rt.startsWith("Defamation")) return selected.has("Defamation");
    return selected.has(rt as FilterType);
  });
}

export function RiskTypeBadges({ types }: { types: string[] }) {
  const visible = types.slice(0, 2);
  const rest = types.length - 2;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {visible.map((rt) => {
        const s = RISK_TYPE_STYLES[rt] ?? { bg: "#F3F4F6", color: "#374151" };
        return (
          <span
            key={rt}
            style={{
              background: s.bg,
              color: s.color,
              fontSize: 11,
              fontWeight: 500,
              borderRadius: 4,
              padding: "2px 6px",
              whiteSpace: "nowrap",
              display: "inline-block",
            }}
          >
            {rt}
          </span>
        );
      })}
      {rest > 0 && (
        <span style={{ fontSize: 11, color: "var(--ink-3)" }}>+{rest} more</span>
      )}
    </div>
  );
}

interface RiskTypeFilterProps {
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
}

export function RiskTypeFilter({ selected, onChange }: RiskTypeFilterProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const allSelected = selected.size === FILTER_TYPES.length;

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  function selectAll() {
    onChange(new Set(FILTER_TYPES));
  }

  function toggle(rt: string) {
    const next = new Set(selected);
    if (next.has(rt)) {
      next.delete(rt);
      if (next.size === 0) {
        onChange(new Set(FILTER_TYPES));
        return;
      }
    } else {
      next.add(rt);
    }
    onChange(next);
  }

  return (
    <div className="field" ref={ref} style={{ position: "relative" }}>
      <span className="fl">RISK TYPE</span>
      <button
        type="button"
        className="cg-select"
        style={{ cursor: "pointer", fontFamily: "inherit" }}
        onClick={() => setOpen((o) => !o)}
      >
        <span>Risk Type</span>
        {!allSelected && (
          <span style={{
            background: "var(--accent)",
            color: "#fff",
            borderRadius: 99,
            padding: "0 6px",
            fontSize: 11,
            fontWeight: 600,
            lineHeight: "18px",
            display: "inline-block",
          }}>
            {selected.size}
          </span>
        )}
        <span style={{ color: "var(--ink-faint)", fontSize: 11, marginLeft: "auto" }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 4px)",
          left: 0,
          width: 220,
          maxHeight: 280,
          overflowY: "auto",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          boxShadow: "0 4px 16px rgba(0,0,0,.12)",
          zIndex: 200,
          padding: "6px 0",
        }}>
          <DropdownItem
            checked={allSelected}
            label="Select All"
            bold
            onClick={selectAll}
          />
          <div style={{ height: 1, background: "var(--border)", margin: "2px 0" }} />
          {FILTER_TYPES.map((rt) => (
            <DropdownItem
              key={rt}
              checked={selected.has(rt)}
              label={rt}
              onClick={() => toggle(rt)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DropdownItem({
  checked,
  label,
  bold,
  onClick,
}: {
  checked: boolean;
  label: string;
  bold?: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 14px",
        cursor: "pointer",
        background: hovered ? "var(--surface-2)" : "transparent",
      }}
    >
      <span className="cbx" role="checkbox" aria-checked={checked} />
      <span style={{ fontSize: 13, fontWeight: bold ? 600 : 400 }}>{label}</span>
    </div>
  );
}
