"""
고정 평가셋 회귀 테스트.
rule_version 변경 시마다 실행하여 recall/precision 추이 기록.
실행: docker compose exec risk-classifier python scripts/run_eval.py
"""
import csv
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.classifiers.legal_lane import run_legal_lane, RULE_VERSION

EVAL_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "eval_set.csv")


def main():
    if not os.path.exists(EVAL_PATH):
        print("eval_set.csv 없음 — build_centroids.py 먼저 실행")
        return

    tp = fp = fn = tn = 0
    with open(EVAL_PATH, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            detected = run_legal_lane(row["text"]) is not None
            is_mal = row["label"] == "malicious"
            if detected and is_mal: tp += 1
            elif detected and not is_mal: fp += 1
            elif not detected and is_mal: fn += 1
            else: tn += 1

    recall = tp / max(tp + fn, 1)
    precision = tp / max(tp + fp, 1)
    print(f"rule_version: {RULE_VERSION}")
    print(f"recall={recall:.1%} precision={precision:.1%} (tp={tp} fp={fp} fn={fn} tn={tn})")
    print("주의: 평가셋 라벨은 '욕설' 기준. 법적 기준 recall의 근사 지표로만 사용.")


if __name__ == "__main__":
    main()
