"use client";
import { useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";

interface Case {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  _count: { evidencePackages: number; custodyLogs: number };
}

interface EvidencePackage {
  id: string;
  pdfS3Key: string;
  checksum: string;
  createdAt: string;
}

const STATUS_ORDER = ["OPEN", "UNDER_REVIEW", "PACKAGED", "REFERRED", "CLOSED"];
const STATUS_COLOR: Record<string, string> = {
  OPEN: "bg-blue-100 text-brand-blue",
  UNDER_REVIEW: "bg-yellow-100 text-yellow-700",
  PACKAGED: "bg-purple-100 text-purple-700",
  REFERRED: "bg-orange-100 text-orange-700",
  CLOSED: "bg-divider-soft text-ink-48",
};

const BFF = process.env.NEXT_PUBLIC_BFF_URL ?? "http://localhost:3001";

function fetcher(url: string, token: string) {
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
}

export default function CasesPage() {
  const { data: session } = useSession();
  const token = (session as any)?.bffToken ?? "";

  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  const { data: cases = [], isLoading, mutate } = useSWR<Case[]>(
    token ? [`${BFF}/api/v1/cases`, token] : null,
    ([url, t]) => fetcher(url, t)
  );

  const { data: packages = [] } = useSWR<EvidencePackage[]>(
    token && selectedCaseId ? [`${BFF}/api/v1/evidence/packages/${selectedCaseId}`, token] : null,
    ([url, t]) => fetcher(url, t)
  );

  async function createCase() {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      await fetch(`${BFF}/api/v1/cases`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: newTitle }),
      });
      setShowModal(false);
      setNewTitle("");
      mutate();
    } finally {
      setCreating(false);
    }
  }

  async function advanceStatus(caseId: string, currentStatus: string) {
    const idx = STATUS_ORDER.indexOf(currentStatus);
    if (idx === -1 || idx === STATUS_ORDER.length - 1) return;
    const newStatus = STATUS_ORDER[idx + 1];
    await fetch(`${BFF}/api/v1/cases/${caseId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ newStatus }),
    });
    mutate();
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-semibold text-ink text-[34px] leading-[1.47] tracking-[-0.374px]">
          Cases
        </h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-brand-blue text-white text-[14px] leading-[1.29] tracking-[-0.224px] px-[22px] py-[11px] rounded-full hover:bg-brand-blue-focus active:scale-95 transition-all"
        >
          New Case
        </button>
      </div>

      <div className="flex gap-5">
        {/* Case list */}
        <div className="flex-1 bg-canvas rounded-[18px] border border-divider-hairline overflow-hidden">
          <div className="px-6 py-3 border-b border-divider-hairline grid grid-cols-4 text-[12px] font-semibold text-ink-48 tracking-[-0.12px] uppercase">
            <span className="col-span-2">Title</span>
            <span>Status</span>
            <span>Created</span>
          </div>

          {isLoading && (
            <p className="px-6 py-10 text-center text-[14px] text-ink-48 tracking-[-0.224px]">Loading…</p>
          )}
          {!isLoading && cases.length === 0 && (
            <p className="px-6 py-10 text-center text-[14px] text-ink-48 tracking-[-0.224px]">
              No cases created yet.
            </p>
          )}

          <div className="divide-y divide-divider-soft">
            {cases.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCaseId(c.id === selectedCaseId ? null : c.id)}
                className={`w-full px-6 py-4 grid grid-cols-4 items-center text-left transition-colors ${
                  selectedCaseId === c.id ? "bg-[#f0f6ff]" : "hover:bg-canvas-parchment"
                }`}
              >
                <span className="col-span-2 text-[17px] text-ink leading-[1.47] tracking-[-0.374px] font-medium">
                  {c.title}
                </span>
                <span>
                  <span className={`text-[12px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[c.status] ?? "bg-divider-soft text-ink-48"}`}>
                    {c.status.replace(/_/g, " ")}
                  </span>
                </span>
                <span className="text-[14px] text-ink-48 tracking-[-0.224px]">
                  {new Date(c.createdAt).toLocaleDateString("ko-KR")}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Case detail panel */}
        {selectedCaseId && (() => {
          const selected = cases.find((c) => c.id === selectedCaseId);
          return selected ? (
            <div className="w-80 flex-shrink-0 space-y-4">
              <div className="bg-canvas border border-divider-hairline rounded-[18px] p-5">
                <h2 className="text-[17px] font-semibold text-ink leading-[1.24] tracking-[-0.374px] mb-1">
                  {selected.title}
                </h2>
                <p className="text-[14px] text-ink-48 tracking-[-0.224px] mb-4">
                  {selected._count.custodyLogs} custody log entries
                </p>
                {selected.status !== "CLOSED" && (
                  <button
                    onClick={() => advanceStatus(selected.id, selected.status)}
                    className="w-full text-[14px] border border-brand-blue text-brand-blue tracking-[-0.224px] px-4 py-[11px] rounded-full hover:bg-blue-50 active:scale-95 transition-all"
                  >
                    Advance → {STATUS_ORDER[STATUS_ORDER.indexOf(selected.status) + 1]?.replace(/_/g, " ")}
                  </button>
                )}
              </div>

              {/* Evidence packages */}
              <div className="bg-canvas border border-divider-hairline rounded-[18px] p-5">
                <h3 className="text-[17px] font-semibold text-ink leading-[1.24] tracking-[-0.374px] mb-3">
                  Evidence Packages ({selected._count.evidencePackages})
                </h3>
                {packages.length === 0 ? (
                  <p className="text-[14px] text-ink-48 tracking-[-0.224px]">No packages generated yet.</p>
                ) : (
                  <div className="divide-y divide-divider-soft">
                    {packages.map((pkg) => (
                      <div key={pkg.id} className="flex items-center justify-between py-3">
                        <div>
                          <p className="font-mono text-[12px] text-ink-48 truncate w-40">{pkg.id}</p>
                          <p className="text-[12px] text-ink-48 mt-0.5">
                            {new Date(pkg.createdAt).toLocaleDateString("ko-KR")}
                          </p>
                        </div>
                        <a
                          href={`${BFF}/api/v1/evidence/download/${pkg.id}`}
                          className="text-[14px] text-brand-blue tracking-[-0.224px] hover:text-brand-blue-focus"
                          target="_blank"
                          rel="noreferrer"
                        >
                          PDF ↓
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null;
        })()}
      </div>

      {/* New Case modal */}
      {showModal && (
        <div className="fixed inset-0 bg-surface-black/40 flex items-center justify-center z-50">
          <div className="bg-canvas rounded-[18px] p-6 w-96 shadow-[0_8px_40px_rgba(0,0,0,0.18)]">
            <h2 className="text-[21px] font-semibold text-ink leading-[1.19] tracking-[0.231px] mb-5">
              New Case
            </h2>
            <input
              type="text"
              placeholder="Case title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createCase()}
              className="w-full border border-divider-hairline rounded-full px-5 py-[11px] text-[17px] text-ink leading-[1.47] tracking-[-0.374px] mb-5 focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="text-[14px] text-ink-48 tracking-[-0.224px] px-[18px] py-[9px] rounded-full hover:bg-canvas-parchment transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createCase}
                disabled={!newTitle.trim() || creating}
                className="bg-brand-blue text-white text-[14px] tracking-[-0.224px] px-[18px] py-[9px] rounded-full hover:bg-brand-blue-focus active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
