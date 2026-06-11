"""
공개 데이터셋에서 카테고리 centroid 생성.
실행: docker compose exec risk-classifier python scripts/build_centroids.py

데이터 소스:
1. ZIZUN korean-malicious-comments (이진: 악성/정상)
   https://raw.githubusercontent.com/ZIZUN/korean-malicious-comments-dataset/master/Dataset.csv
2. (선택) KOLD — 수동 다운로드 필요 시 data/ 에 배치

출력:
- config/centroids/insult.npy        (악성 댓글 전체 centroid)
- config/centroids/negative_act.npy  (비위 행위 시드 문장 centroid)
- data/eval_set.csv                  (평가셋 1000건, 학습 미사용 보장)
- 캘리브레이션 리포트 stdout 출력

데이터셋은 학습용으로 사용 금지 — centroid/보정/평가 전용.
"""
import csv
import io
import os
import urllib.request

import numpy as np
from sentence_transformers import SentenceTransformer

BASE = os.path.join(os.path.dirname(__file__), "..")
CENTROID_DIR = os.path.join(BASE, "config", "centroids")
DATA_DIR = os.path.join(BASE, "data")
ZIZUN_URL = "https://raw.githubusercontent.com/ZIZUN/korean-malicious-comments-dataset/master/Dataset.csv"

# 비위 행위 의미권 시드 (centroid의 씨앗 — 패턴 아님, 의미 공간 좌표)
NEGATIVE_ACT_SEEDS = [
    "회삿돈을 횡령했다", "돈을 빼돌렸다", "사기를 쳤다", "탈세를 했다",
    "직원을 폭행했다", "성희롱을 했다", "거래처 돈을 떼먹었다", "잠적했다",
    "음주운전을 했다", "마약을 했다", "도박에 빠졌다", "사람을 속였다",
    "갑질을 했다", "임금을 체불했다", "불법으로 운영했다", "뇌물을 받았다",
]


def main():
    os.makedirs(CENTROID_DIR, exist_ok=True)
    os.makedirs(DATA_DIR, exist_ok=True)
    model = SentenceTransformer("snunlp/KR-SBERT-V40K-klueNLI-augSTS")

    # 1. negative_act centroid (시드 기반)
    seed_embeds = model.encode(NEGATIVE_ACT_SEEDS, normalize_embeddings=True)
    np.save(os.path.join(CENTROID_DIR, "negative_act.npy"), seed_embeds.mean(axis=0))
    print(f"[OK] negative_act centroid ({len(NEGATIVE_ACT_SEEDS)} seeds)")

    # 2. ZIZUN 다운로드
    print("[..] downloading ZIZUN dataset")
    raw = urllib.request.urlopen(ZIZUN_URL, timeout=60).read().decode("utf-8")
    rows = list(csv.reader(io.StringIO(raw)))[1:]
    # 형식: [text, label] — label 0=악성, 1=정상 (README 기준; 반대면 아래 스왑)
    malicious = [r[0] for r in rows if len(r) >= 2 and r[1].strip() == "0"]
    normal = [r[0] for r in rows if len(r) >= 2 and r[1].strip() == "1"]
    print(f"[OK] ZIZUN loaded: malicious={len(malicious)}, normal={len(normal)}")

    # 3. 평가셋 분리 (centroid 생성에 미사용 — 오염 방지)
    eval_mal, train_mal = malicious[:500], malicious[500:]
    eval_norm, train_norm = normal[:500], normal[500:]
    with open(os.path.join(DATA_DIR, "eval_set.csv"), "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["text", "label"])
        for t in eval_mal:
            w.writerow([t, "malicious"])
        for t in eval_norm:
            w.writerow([t, "normal"])
    print("[OK] eval_set.csv (1000 rows, held out)")

    # 4. insult centroid (평가셋 제외분으로)
    mal_embeds = model.encode(train_mal[:3000], normalize_embeddings=True,
                              batch_size=64, show_progress_bar=True)
    np.save(os.path.join(CENTROID_DIR, "insult.npy"), mal_embeds.mean(axis=0))
    print("[OK] insult centroid")

    # 5. 캘리브레이션: 정상 댓글의 false positive율 측정
    insult_c = mal_embeds.mean(axis=0)
    insult_c = insult_c / np.linalg.norm(insult_c)
    norm_embeds = model.encode(train_norm[:2000], normalize_embeddings=True,
                               batch_size=64, show_progress_bar=True)
    sims = norm_embeds @ insult_c
    print("\n=== Calibration (normal comments vs insult centroid) ===")
    for th in [0.50, 0.55, 0.60, 0.65, 0.70, 0.75]:
        fp_rate = float((sims >= th).mean())
        print(f"  threshold {th:.2f} → false positive rate {fp_rate:.1%}")
    print("→ legal_lane.py의 EMBED_CANDIDATE_THRESHOLD를 FP율 5~10% 지점으로 조정하라")


if __name__ == "__main__":
    main()
