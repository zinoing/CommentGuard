"""
한국어 NLI 기반 zero-shot 분류.
가설(hypothesis)이 패턴을 대체한다. 새 표현이 나와도 의미만 통하면 잡힌다.
느리므로(댓글당 수백 ms) Legal Lane 후보에만 적용한다.
"""
from functools import lru_cache

from transformers import pipeline

NLI_VERSION = "nli-zeroshot-v1.0.0"

# 법적 구성요건을 가설로 표현. 패턴 유지보수 대신 가설 5~6개만 관리.
HYPOTHESES = {
    "factual_allegation": "이 댓글은 특정인이 비위 행위나 범죄를 저질렀다고 주장한다",
    "threat": "이 댓글은 특정인을 위협하거나 해를 가하겠다고 말한다",
    "harassment": "이 댓글은 특정인을 지속적으로 괴롭히려는 내용이다",
    "insult": "이 댓글은 특정인을 모욕하거나 비하한다",
    "benign": "이 댓글은 단순한 감상, 응원, 또는 일반적인 의견이다",
}

HYPOTHESIS_TO_ALLEGATION = {
    "factual_allegation": "illegal_activity",
    "threat": "illegal_activity",
    "harassment": "reputational_harm",
    "insult": "insult_only",
}


@lru_cache(maxsize=1)
def _load_nli():
    # 한국어 NLI 학습 모델. 다운로드 실패 시 대체: "MoritzLaurer/mDeBERTa-v3-base-mnli-xnli"
    return pipeline(
        "zero-shot-classification",
        model="pongjin/roberta_with_kornli",
    )


def classify_nli(text: str) -> dict:
    """
    returns: {
        "best_hypothesis": str,
        "best_score": float,
        "scores": {key: prob},
        "allegation_hint": str | None,
        "is_benign": bool,
    }
    """
    clf = _load_nli()
    labels = list(HYPOTHESES.values())
    result = clf(text, candidate_labels=labels, multi_label=False)

    label_to_key = {v: k for k, v in HYPOTHESES.items()}
    scores = {label_to_key[l]: s for l, s in zip(result["labels"], result["scores"])}
    best_key = label_to_key[result["labels"][0]]
    best_score = result["scores"][0]

    return {
        "best_hypothesis": best_key,
        "best_score": float(best_score),
        "scores": scores,
        "allegation_hint": HYPOTHESIS_TO_ALLEGATION.get(best_key),
        "is_benign": best_key == "benign",
    }
