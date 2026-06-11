"""
KR-SBERT 기반 의미 해석.
- 부정 행위 의미 유사도: "이 표현이 비위/범죄 행위 의미권에 속하는가"
- centroid 방식: 개별 문장 max 유사도보다 노이즈에 강함
- centroid는 config/centroids/*.npy 에서 로드 (스크립트로 생성, build_centroids.py 참조)
"""
import os
from functools import lru_cache

import numpy as np
import yaml
from sentence_transformers import SentenceTransformer

EMBED_VERSION = "kr-sbert-centroid-v1.0.0"

_CONFIG_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "config")
_CENTROID_DIR = os.path.join(_CONFIG_DIR, "centroids")
_PATTERNS_PATH = os.path.join(_CONFIG_DIR, "legal_risk_patterns.yaml")

# 카테고리 → allegation_type 매핑
CATEGORY_TO_ALLEGATION = {
    "threat": "illegal_activity",
    "negative_act": "illegal_activity",     # 비위/범죄 행위 의미권 (centroid)
    "insult": "insult_only",                # 데이터셋 centroid
    "harassment": "reputational_harm",
}


@lru_cache(maxsize=1)
def _load_model() -> SentenceTransformer:
    return SentenceTransformer("snunlp/KR-SBERT-V40K-klueNLI-augSTS")


@lru_cache(maxsize=1)
def _load_centroids() -> dict[str, np.ndarray]:
    """config/centroids/*.npy 로드. 파일명 = 카테고리명."""
    centroids = {}
    if os.path.isdir(_CENTROID_DIR):
        for fname in os.listdir(_CENTROID_DIR):
            if fname.endswith(".npy"):
                cat = fname[:-4]
                centroids[cat] = np.load(os.path.join(_CENTROID_DIR, fname))
    return centroids


@lru_cache(maxsize=1)
def _load_pattern_embeddings():
    """명백 케이스 속탐지용 소수 패턴 (협박 직접 표현 등)."""
    if not os.path.exists(_PATTERNS_PATH):
        return "none", {}
    with open(_PATTERNS_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    model = _load_model()
    cat_embeds = {}
    for cat_id, cat in data.get("categories", {}).items():
        cat_embeds[cat_id] = model.encode(cat["patterns"], normalize_embeddings=True)
    return data.get("version", "unknown"), cat_embeds


def classify_semantic(text: str) -> dict:
    """
    centroid 유사도 + 패턴 유사도 통합.
    returns: {
        "best_category": str | None,
        "best_score": float,
        "category_scores": {cat: score},
        "allegation_hint": str | None,
        "negative_act_similarity": float,  # 구성요건 ③용
    }
    """
    model = _load_model()
    query = model.encode([text], normalize_embeddings=True)[0]

    category_scores: dict[str, float] = {}

    # centroid 비교 (정규화된 centroid와 dot = cosine)
    for cat, centroid in _load_centroids().items():
        c = centroid / np.linalg.norm(centroid)
        category_scores[cat] = float(np.dot(c, query))

    # 패턴 비교 (명백 케이스 속탐지)
    _, pattern_embeds = _load_pattern_embeddings()
    for cat, embeds in pattern_embeds.items():
        sims = embeds @ query
        score = float(np.max(sims))
        category_scores[cat] = max(category_scores.get(cat, 0.0), score)

    if not category_scores:
        return {
            "best_category": None, "best_score": 0.0,
            "category_scores": {}, "allegation_hint": None,
            "negative_act_similarity": 0.0,
        }

    best_category = max(category_scores, key=category_scores.get)
    best_score = category_scores[best_category]

    return {
        "best_category": best_category,
        "best_score": best_score,
        "category_scores": category_scores,
        "allegation_hint": CATEGORY_TO_ALLEGATION.get(best_category),
        "negative_act_similarity": category_scores.get("negative_act", 0.0),
    }
