"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

interface InviteInfo {
  channelName: string;
  status: string;
  isExpired: boolean;
}

export default function InvitePage() {
  const params = useParams();
  const token = params.token as string;

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/channels/invite/${token}`)
      .then(async (res) => {
        if (!res.ok) { setInvalid(true); return; }
        const data = await res.json();
        if (data.isExpired || data.status !== "PENDING") { setInvalid(true); return; }
        setInvite(data);
      })
      .catch(() => setInvalid(true))
      .finally(() => setLoading(false));
  }, [token]);

  function handleGoogleOAuth() {
    // OAuth stub — 실제 구현 시 Google OAuth 플로우 시작
    // 현재는 UI만, 콜백은 미구현
    alert("Google OAuth 연동은 준비 중입니다.");
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="muted">확인 중…</div>
      </div>
    );
  }

  if (invalid || !invite) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div className="card" style={{ maxWidth: 400, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>유효하지 않은 초대 링크</div>
          <div className="muted" style={{ fontSize: 14 }}>
            만료되었거나 이미 사용된 링크입니다. MCN에 재발급을 요청하세요.
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div className="card" style={{ maxWidth: 400, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>연동이 완료되었습니다</div>
          <div className="muted" style={{ fontSize: 14 }}>창을 닫아도 됩니다.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <div className="card" style={{ maxWidth: 440 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div className="shield" style={{ flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontSize: 16 }}>CommentGuard</span>
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          {invite.channelName}님, 연동 요청을 받으셨습니다
        </h2>
        <div className="muted" style={{ fontSize: 14, marginBottom: 24 }}>
          MCN이 내 채널 댓글에 <strong>읽기 전용</strong>으로 접근합니다.
          법적 리스크 모니터링 목적으로만 사용됩니다.
        </div>

        <button className="btn primary" style={{ width: "100%" }} onClick={handleGoogleOAuth}>
          Google 계정으로 동의
        </button>
      </div>
    </div>
  );
}
