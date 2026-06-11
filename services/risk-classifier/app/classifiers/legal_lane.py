"""
Legal Lane 메인 로직.
구성요건 분해(element) + 의미 분류(embedding/NLI) → legal_score 합성.
GPT 도입 시 이 합성 입력을 GPT 출력으로 교체하면 됨. 점수 로직은 불변.
"""
from app.classifiers.morpheme_analyzer import analyze_structure
from app.classifiers.semantic_classifier import classify_semantic
from app.classifiers.nli_classifier import classify_nli

RULE_VERSION = "legal-rule-v2.0.0"
MODEL_VERSION = "rule-only-v2"
HUMAN_REVIEW_THRESHOLD = 0.7

# Legal Lane 후보 진입 임계값 (데이터셋 캘리브레이션 후 조정 — build_centroids.py)
EMBED_CANDIDATE_THRESHOLD = 0.60
NLI_CANDIDATE_THRESHOLD = 0.55


def check_defamation_elements(structure: dict, semantic: dict) -> float:
    """
    사실적시 명예훼손 구성요건 점수 (0.0 ~ 1.0).
    ① 구체적 사실의 적시  ② 특정인 지칭 가능  ③ 사회적 평가 저하 내용
    문장 패턴이 아니라 구성요건의 존재를 본다.
    """
    score = 0.0

    # ① 구체적 사실 적시
    if structure["assertion_strength"] == 2:
        score += 0.4
    elif structure["assertion_strength"] == 1:
        score += 0.15
    if structure["has_specifics"]:
        score += 0.2  # 시점/금액 특정 = 사실 적시 강력 신호

    # ② 특정성
    if structure["target_specificity"] == "explicit":
        score += 0.2
    elif structure["target_specificity"] == "implicit":
        score += 0.1

    # ③ 평가 저하 행위 (의미 해석 — 임베딩이 담당)
    score += min(semantic["negative_act_similarity"], 1.0) * 0.2

    return min(score, 1.0)


def calculate_legal_score(merged: dict) -> float:
    """GPT/룰 공용 점수 합성. 입력 스키마만 맞으면 소스 무관."""
    score = 0.0

    strength = int(merged.get("assertion_strength", 0))
    score += (strength / 2) * 0.3

    allegations = merged.get("allegation_type", [])
    if "illegal_activity" in allegations:
        score += 0.3
    elif any(a in allegations for a in ["ethical_violation", "reputational_harm"]):
        score += 0.2

    specificity = merged.get("target_specificity", "none")
    if specificity == "explicit":
        score += 0.2
    elif specificity == "implicit":
        score += 0.1

    if not merged.get("evidence_present", True):
        score += 0.2

    return min(score, 1.0)


def run_legal_lane(comment_text: str) -> dict | None:
    # 레이어 1: 문법 구조
    structure = analyze_structure(comment_text)

    # 레이어 2a: 의미 (centroid/패턴)
    semantic = classify_semantic(comment_text)

    # 구성요건 분해 점수 (사실적시 핵심 경로)
    element_score = check_defamation_elements(structure, semantic)

    # 후보 진입 판정 1차 (NLI 비용 절약: 명백히 무해하면 NLI 생략)
    early_candidate = (
        semantic["best_score"] >= EMBED_CANDIDATE_THRESHOLD
        or element_score >= 0.5
    )

    # 레이어 2b: NLI (후보 가능성 있을 때만)
    nli = None
    if early_candidate or structure["assertion_strength"] == 2:
        nli = classify_nli(comment_text)

    # 최종 후보 판정 (OR — recall 우선)
    is_candidate = (
        semantic["best_score"] >= EMBED_CANDIDATE_THRESHOLD
        or element_score >= 0.5
        or (nli and not nli["is_benign"] and nli["best_score"] >= NLI_CANDIDATE_THRESHOLD)
    )
    if not is_candidate:
        return None

    # allegation_type 병합 (element + embedding + nli)
    allegations: set[str] = set()
    if element_score >= 0.5:
        allegations.add("reputational_harm")
    if element_score >= 0.7:
        allegations.add("illegal_activity")
    if semantic["allegation_hint"]:
        allegations.add(semantic["allegation_hint"])
    if nli and nli["allegation_hint"] and not nli["is_benign"]:
        allegations.add(nli["allegation_hint"])
    final_allegations = sorted(allegations) if allegations else ["none"]

    merged = {
        "assertion_strength": structure["assertion_strength"],
        "allegation_type": final_allegations,
        "target_specificity": structure["target_specificity"],
        "evidence_present": structure["evidence_present"],
    }
    legal_score = max(calculate_legal_score(merged), element_score * 0.9)

    return {
        "ruleVersion": RULE_VERSION,
        "modelVersion": MODEL_VERSION,
        "expressionType": structure["expression_type"],
        "targetSpecificity": structure["target_specificity"],
        "allegationTypes": final_allegations,
        "assertionStrength": structure["assertion_strength"],
        "evidencePresent": structure["evidence_present"],
        "evidenceTypes": structure["evidence_type"],
        "extractedEntities": structure["extracted_entities"],
        "elementScore": round(element_score, 3),
        "embeddingScore": round(semantic["best_score"], 3),
        "embeddingCategory": semantic["best_category"],
        "nliScore": round(nli["best_score"], 3) if nli else 0.0,
        "nliHypothesis": nli["best_hypothesis"] if nli else None,
        "legalScore": round(legal_score, 3),
        "requiresHumanReview": legal_score >= HUMAN_REVIEW_THRESHOLD,
        "classification": "reference_only",
        "labels": _build_labels(structure, semantic, nli, final_allegations, element_score),
    }


def _build_labels(structure, semantic, nli, allegations, element_score) -> list[str]:
    """원자적 라벨. 판단이 아니라 관측 사실."""
    labels = []
    labels.append(f"assertion.{['question','suspicion','fact'][structure['assertion_strength']]}")
    if structure["target_specificity"] != "none":
        labels.append(f"target.{structure['target_specificity']}")
    if structure["has_specifics"]:
        labels.append("claim.specific_details")
    for a in allegations:
        if a != "none":
            labels.append(f"claim.{a}")
    if not structure["evidence_present"]:
        labels.append("evidence.none")
    if element_score >= 0.5:
        labels.append("element.defamation_candidate")
    if semantic["best_category"]:
        labels.append(f"pattern.{semantic['best_category']}")
    if nli and not nli["is_benign"]:
        labels.append(f"nli.{nli['best_hypothesis']}")
    return labels
