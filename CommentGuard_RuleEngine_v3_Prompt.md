# [CommentGuard] Rule Engine v3 — GPT 없는 Legal Lane 구현 (프로토타입)

> v2 대비 변경점:
> 
> - 사실적시 명예훼손: 문장 패턴 매칭 → **법적 구성요건 분해 방식**으로 전환
> - NLI zero-shot 분류 추가 (패턴 입력 불필요한 의미 분류)
> - Risk Pattern Library 역할 축소: 명백 케이스(협박 직접 표현 등) 속탐지 전용
> - 외부 공개 데이터셋 활용: centroid 자동 추출 + 임계값 캘리브레이션 + 평가셋
> - 데이터셋은 학습용으로 사용 금지 — centroid/보정/평가 전용

-----

## 배경

CommentGuard 분류 파이프라인은 Ops Lane / Legal Lane 완전 독립 병렬 구조다.
프로토타입 단계이므로 GPT-4o는 사용하지 않는다.

설계 철학:

- 문장 패턴 매칭은 표현의 무한성을 못 따라간다. “회삿돈을 횡령했습니다”는 잡아도 “법인카드로 명품 산 거 다 알고 있다”는 놓친다.
- 사실적시 명예훼손은 법적으로 이미 “구성요건의 조합”으로 정의되어 있다. 문장을 찾지 말고 구성요건을 찾는다.
- 해석 주체 분리: 분해=Kiwi / 문법 해석=룰 / 의미 해석=임베딩·NLI / 종합=코드 / 판단=사람
- GPT 도입 시 “교체”가 아니라 “업그레이드”가 되도록 출력 스키마는 GPT 버전과 동일하게 유지
- modelVersion 필드로 분류 방식 추적 (“rule-only-v2” → 추후 “gpt-4o”)
- recall 우선. false positive는 사람이 거른다. false negative만 치명적이다.

-----

## 0. 의존성 추가

services/risk-classifier/requirements.txt에 추가:

```
kiwipiepy>=0.18.0
sentence-transformers>=2.7.0
transformers>=4.40.0
torch>=2.0.0
PyYAML>=6.0
scikit-learn>=1.4.0
```

docker-compose.yml의 risk-classifier 서비스에 HuggingFace 캐시 볼륨 추가:

```yaml
volumes:
  - hf_cache:/root/.cache/huggingface
```

최하단 volumes 섹션에 `hf_cache:` 추가.

-----

## 1. DB 스키마 추가

packages/db/prisma/schema.prisma에 아래 3개 모델 추가.
기존 마이그레이션 수정 금지.
마이그레이션 이름: add_signal_tables

```prisma
model CommentOpsSignal {
  id              String   @id @default(cuid())
  commentId       String
  ruleVersion     String
  detectedAt      DateTime @default(now())
  spamFlags       String[]
  repetitionCount Int      @default(0)
  urlRatio        Float    @default(0)
  opsScore        Float
  labels          String[]
  classification  String   @default("reference_only")

  @@index([commentId])
}

model CommentLegalSignal {
  id                  String   @id @default(cuid())
  commentId           String
  ruleVersion         String
  modelVersion        String   @default("rule-only-v2")
  detectedAt          DateTime @default(now())
  expressionType      String   // "fact" | "suspicion" | "opinion" | "quotation" | "mixed"
  targetSpecificity   String   // "explicit" | "implicit" | "none"
  allegationTypes     String[]
  assertionStrength   Int      // 0 | 1 | 2
  evidencePresent     Boolean
  evidenceTypes       String[]
  extractedEntities   String[]
  // 탐지 경로별 신호 (설명가능성)
  elementScore        Float    @default(0) // 구성요건 분해 점수
  embeddingScore      Float    @default(0) // centroid/패턴 최고 유사도
  embeddingCategory   String?
  nliScore            Float    @default(0) // NLI zero-shot 최고 확률
  nliHypothesis       String?
  legalScore          Float
  notes               String?
  requiresHumanReview Boolean  @default(false)
  classification      String   @default("reference_only")

  @@index([commentId])
  @@index([requiresHumanReview])
}

model CommentLabel {
  id          String   @id @default(cuid())
  commentId   String
  label       String
  lane        String   // "legal" | "ops"
  source      String   // "rule" | "embedding" | "nli" | "element"
  ruleVersion String?
  detectedAt  DateTime @default(now())

  @@index([commentId])
  @@index([label])
}
```

마이그레이션:

```bash
docker compose exec bff-api pnpm --filter @commentguard/db exec prisma migrate dev --name add_signal_tables
docker compose exec bff-api pnpm run db:generate
```

-----

## 2. 형태소 구조 분석기 (Kiwi) — 레이어 1: 문법 해석

파일 생성: services/risk-classifier/app/classifiers/morpheme_analyzer.py

역할: 문법 구조(어미·시제·품사)에서 읽을 수 있는 사실만 추출.
의미 해석은 하지 않는다 (그건 임베딩/NLI 담당).

```python
"""
Kiwi 형태소 분석 기반 댓글 구조 분해.
어미/시제/품사는 한국어 문법 사실이므로 룰로 판별한다.
출력 스키마는 GPT 버전과 동일하게 유지한다.
"""
import re
from kiwipiepy import Kiwi

ANALYZER_VERSION = "morpheme-v2.0.0"

kiwi = Kiwi()

# 단정형 어미/표현 (assertion_strength = 2)
ASSERTIVE_MARKERS = ["었다", "았다", "했다", "이다", "였다", "입니다", "습니다", "한 거", "은 거", "ㄴ 거"]
FIRSTHAND_MARKERS = ["직접", "내가 봤", "제가 봤", "두 눈으로", "현장에서", "당해봤", "겪어봤"]

# 추측/전문형 (assertion_strength = 1)
SUSPICION_MARKERS = ["같다", "듯하다", "카더라", "라던데", "다는 소문", "다는 얘기", "들었", "아닐까", "인 것 같", "다더라", "라고 하더"]

# 의문형 (assertion_strength = 0)
QUESTION_MARKERS = ["일까", "인가", "혹시", "아닌가"]

# 지시 대명사 / 암시적 지칭
IMPLICIT_TARGET_MARKERS = ["이 사람", "저 사람", "쟤", "얘", "저 유튜버", "이 유튜버",
                            "사장", "대표", "그 사람", "본인", "당사자", "이 새끼", "저 인간"]

# 증거 언급 패턴
EVIDENCE_MARKERS = {
    "firsthand_experience": ["직접 봤", "내가 겪", "제가 당했", "현장에 있었", "당해봤"],
    "document_reference": ["계약서", "녹취", "증거 있", "캡처", "스크린샷", "문자 내역", "통장 내역"],
    "external_source": ["기사에", "뉴스에", "방송에", "판결문", "공시"],
    "hearsay": ["들었", "카더라", "소문", "얘기가", "라던데", "다더라"],
}

# 구체성 신호 (사실적시 구성요건 ①의 강력 신호)
SPECIFICITY_PATTERNS = re.compile(
    r"\d{4}년|\d{1,2}월|\d{1,2}일|\d+억|\d+천만|\d+만원|\d+원|\d+시|\d+살|\d+년 전"
)


def analyze_structure(text: str) -> dict:
    tokens = kiwi.analyze(text)[0][0]
    proper_nouns = [t.form for t in tokens if t.tag == "NNP"]

    # --- assertion_strength ---
    strength = 0
    if any(m in text for m in FIRSTHAND_MARKERS):
        strength = 2
    elif any(m in text for m in ASSERTIVE_MARKERS) and not any(m in text for m in SUSPICION_MARKERS):
        strength = 2
    elif any(m in text for m in SUSPICION_MARKERS):
        strength = 1
    elif any(m in text for m in QUESTION_MARKERS) or "?" in text:
        strength = 0
    elif any(m in text for m in ASSERTIVE_MARKERS):
        strength = 1

    # --- expression_type ---
    has_suspicion = any(m in text for m in SUSPICION_MARKERS)
    has_assertive = any(m in text for m in ASSERTIVE_MARKERS)
    if has_assertive and has_suspicion:
        expression_type = "mixed"
    elif has_suspicion:
        expression_type = "suspicion"
    elif has_assertive:
        expression_type = "fact"
    else:
        expression_type = "opinion"

    # --- target_specificity ---
    if proper_nouns:
        target_specificity = "explicit"
    elif any(m in text for m in IMPLICIT_TARGET_MARKERS):
        target_specificity = "implicit"
    else:
        target_specificity = "none"

    # --- 구체성 (시점/금액/장소 등 특정) ---
    has_specifics = bool(SPECIFICITY_PATTERNS.search(text))

    # --- evidence ---
    evidence_types = []
    for ev_type, markers in EVIDENCE_MARKERS.items():
        if any(m in text for m in markers):
            evidence_types.append(ev_type)
    evidence_present = any(
        e in evidence_types
        for e in ["firsthand_experience", "document_reference", "external_source"]
    )
    if not evidence_types:
        evidence_types = ["none"]

    return {
        "expression_type": expression_type,
        "target_specificity": target_specificity,
        "assertion_strength": strength,
        "has_specifics": has_specifics,
        "evidence_present": evidence_present,
        "evidence_type": evidence_types,
        "extracted_entities": proper_nouns,
        "analyzer_version": ANALYZER_VERSION,
    }
```

-----

## 3. 의미 분류기 (임베딩 centroid + NLI) — 레이어 2: 의미 해석

### 3-1. 부정 행위 의미 공간 (centroid 기반)

파일 생성: services/risk-classifier/app/classifiers/semantic_classifier.py

```python
"""
KR-SBERT 기반 의미 해석.
- 부정 행위 의미 유사도: "이 표현이 비위/범죄 행위 의미권에 속하는가"
- centroid 방식: 개별 문장 max 유사도보다 노이즈에 강함
- centroid는 config/centroids/*.npy 에서 로드 (스크립트로 생성, §7 참조)
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
```

### 3-2. NLI Zero-shot 분류기 (패턴 불필요)

파일 생성: services/risk-classifier/app/classifiers/nli_classifier.py

```python
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
```

-----

## 4. Risk Pattern Library — 역할 축소

파일 생성: services/risk-classifier/config/legal_risk_patterns.yaml

> v2와 달리 “명백 케이스 속탐지 전용”. 사실적시는 패턴으로 잡지 않는다 (구성요건 분해가 담당).
> 협박 직접 표현처럼 표현 변형이 적은 영역만 패턴 유지.

```yaml
version: "legal-patterns-v2.0.0"
role: "explicit-case fast detection only. defamation is handled by element decomposition."
categories:
  threat:
    label: "협박 직접 표현"
    patterns:
      - "죽여버리겠다"
      - "가만 안 둔다"
      - "찾아가서 가만두지 않겠다"
      - "집 주소 안다 조심해라"
      - "밤길 조심해라"
      - "신상 다 털어버리겠다"
  harassment:
    label: "지속적 괴롭힘 선언"
    patterns:
      - "계속 따라다니면서 괴롭힐 거다"
      - "영상 올릴 때마다 찾아오겠다"
      - "그만둘 때까지 멈추지 않는다"
```

-----

## 5. Legal Lane 통합 — 레이어 3: 종합 (코드)

파일 생성: services/risk-classifier/app/classifiers/legal_lane.py

```python
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

# Legal Lane 후보 진입 임계값 (데이터셋 캘리브레이션 후 조정 — §7)
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
```

-----

## 6. Ops Lane Rule Engine

파일 생성: services/risk-classifier/app/classifiers/ops_rule_engine.py

(v2와 동일 — 변경 없음)

```python
import re
from dataclasses import dataclass, field

OPS_RULE_VERSION = "ops-v1.0.0"

URL_PATTERN = re.compile(r"https?://\S+")
REPEAT_CHAR_PATTERN = re.compile(r"([ㅋㅎㅠㅜ!.?])\1{9,}")
EMOJI_PATTERN = re.compile(
    "[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F000-\U0001F02F]"
)


@dataclass
class OpsSignal:
    comment_id: str
    rule_version: str
    spam_flags: list[str] = field(default_factory=list)
    repetition_count: int = 0
    url_ratio: float = 0.0
    ops_score: float = 0.0
    labels: list[str] = field(default_factory=list)
    classification: str = "reference_only"


_WEIGHTS = {
    "spam.repetition": 0.3,
    "spam.promotion": 0.2,
    "noise.low_semantic_density": 0.1,
    "bot.like_pattern": 0.25,
    "coordinated.attack": 0.35,
}


def calculate_ops_score(flags: list[str]) -> float:
    return min(sum(_WEIGHTS.get(f, 0) for f in flags), 1.0)


def run_ops_rules(comment: dict, account_pattern: dict | None, duplicate_count: int) -> OpsSignal:
    text = comment["text"]
    flags: list[str] = []

    if duplicate_count >= 3:
        flags.append("spam.repetition")

    tokens = text.split()
    urls = URL_PATTERN.findall(text)
    url_ratio = len(urls) / max(len(tokens), 1)
    if url_ratio >= 0.3:
        flags.append("spam.promotion")

    emoji_count = len(EMOJI_PATTERN.findall(text))
    if (
        REPEAT_CHAR_PATTERN.search(text)
        or (len(text) > 0 and emoji_count / len(text) >= 0.7)
        or len(tokens) <= 3
    ):
        flags.append("noise.low_semantic_density")

    if account_pattern:
        if account_pattern.get("is_new_account") and account_pattern.get("comment_count_30d", 0) >= 50:
            flags.append("bot.like_pattern")
        if account_pattern.get("repeat_attack_flag"):
            flags.append("coordinated.attack")

    return OpsSignal(
        comment_id=comment["id"],
        rule_version=OPS_RULE_VERSION,
        spam_flags=flags,
        repetition_count=duplicate_count,
        url_ratio=round(url_ratio, 3),
        ops_score=calculate_ops_score(flags),
        labels=flags,
    )
```

-----

## 7. 데이터셋 활용 스크립트 (centroid 생성 + 캘리브레이션 + 평가셋)

> 데이터셋은 학습용 ❌ / centroid 추출·임계값 보정·평가셋 ⭕
> 데이터셋 라벨은 “욕설/혐오” 기준이므로 법적 분류기 직접 학습에 쓰지 않는다.

파일 생성: services/risk-classifier/scripts/build_centroids.py

```python
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
```

파일 생성: services/risk-classifier/scripts/run_eval.py

```python
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
```

-----

## 8. 분류 API 엔드포인트

파일 생성: services/risk-classifier/app/routes/classify_lanes.py

```python
from fastapi import APIRouter
from pydantic import BaseModel

from app.classifiers.ops_rule_engine import run_ops_rules
from app.classifiers.legal_lane import run_legal_lane

router = APIRouter()


class ClassifyLaneRequest(BaseModel):
    comment_id: str
    text: str
    author_id: str
    channel_id: str
    duplicate_count: int = 0
    account_pattern: dict | None = None


class ClassifyLaneResponse(BaseModel):
    comment_id: str
    ops_signal: dict | None
    legal_signal: dict | None


@router.post("/api/v1/classify/lanes", response_model=ClassifyLaneResponse)
async def classify_lanes(req: ClassifyLaneRequest) -> ClassifyLaneResponse:
    comment = {
        "id": req.comment_id,
        "text": req.text,
        "author_id": req.author_id,
        "channel_id": req.channel_id,
    }

    # Ops Lane — 항상 실행. Legal 실패와 무관.
    ops = run_ops_rules(comment, req.account_pattern, req.duplicate_count)
    ops_dict = {
        "ruleVersion": ops.rule_version,
        "spamFlags": ops.spam_flags,
        "repetitionCount": ops.repetition_count,
        "urlRatio": ops.url_ratio,
        "opsScore": ops.ops_score,
        "labels": ops.labels,
        "classification": ops.classification,
    }

    # Legal Lane — 독립 실행. 예외가 Ops 결과를 막지 않게 격리.
    try:
        legal = run_legal_lane(req.text)
    except Exception:
        import logging
        logging.getLogger(__name__).exception("legal lane failed for %s", req.comment_id)
        legal = None

    return ClassifyLaneResponse(
        comment_id=req.comment_id,
        ops_signal=ops_dict,
        legal_signal=legal,
    )
```

main.py에 라우터 등록:

```python
from app.routes.classify_lanes import router as classify_lanes_router
app.include_router(classify_lanes_router)
```

-----

## 9. bff-api 연결 — 수집 후 분류 호출 + 결과 저장

services/bff-api/src/routes/collect.ts의 `video_done` 이벤트 처리 수정.

댓글 INSERT 성공 후, 각 신규 댓글에 대해:

1. 같은 채널 내 동일 text 수 카운트 (duplicate_count)
1. risk-classifier `POST /api/v1/classify/lanes` 호출
1. ops_signal → `commentOpsSignal.create`
1. legal_signal이 null 아니면 → `commentLegalSignal.create`
1. labels → `commentLabel.createMany`
- ops labels: { lane: “ops”, source: “rule” }
- legal labels: source는 라벨 접두어로 결정
  - “element.” → “element” / “pattern.” → “embedding” / “nli.” → “nli” / 그 외 → “rule”

주의:

- 분류 호출 실패가 수집을 실패시키면 안 됨 — try/catch + 로그
- 동일 commentId에 signal 이미 있으면 skip
- CLASSIFIER_URL 환경변수 사용

-----

## 10. 검증

```bash
# 1. rebuild (requirements 변경)
docker compose up --build risk-classifier -d

# 2. centroid 생성 + 캘리브레이션 (최초 1회)
docker compose exec risk-classifier python scripts/build_centroids.py
# → 출력된 FP율 표를 보고 EMBED_CANDIDATE_THRESHOLD 조정

# 3. Legal Lane 핵심 테스트 — 패턴에 없는 표현이 잡히는가
docker compose exec risk-classifier python3 -c "
from app.classifiers.legal_lane import run_legal_lane
import json

cases = [
    # (설명, 텍스트, 잡혀야 하는가)
    ('패턴에 없는 사실적시', '법인카드로 명품 산 거 다 알고 있다 2023년 3월이었지', True),
    ('전형적 사실적시',     '이 사람 2022년에 회삿돈 3억 빼돌린 거 제가 직접 봤습니다', True),
    ('협박',               '너 죽여버린다 집 주소 안다', True),
    ('의혹 제기',           '뒷광고 받는다는 소문이 있던데 사실인가요', True),
    ('무해한 칭찬',         '오늘 영상 너무 재밌었어요 다음 편 기대합니다', False),
    ('무해 + 돈 언급',      '회삿돈으로 직원들 회식 시켜준 사장님 멋지다', False),
]
for desc, text, expect in cases:
    r = run_legal_lane(text)
    got = r is not None
    mark = 'PASS' if got == expect else 'FAIL'
    score = r['legalScore'] if r else '-'
    print(f'[{mark}] {desc}: detected={got} score={score}')
"

# 4. 평가셋 회귀 테스트
docker compose exec risk-classifier python scripts/run_eval.py

# 5. end-to-end: 채널 등록 → 수집 → DB 확인
docker compose exec -it postgres psql -U commentguard -d commentguard -c \
  'SELECT "commentId", "legalScore", "elementScore", "embeddingScore", "nliScore", "allegationTypes" FROM "CommentLegalSignal" ORDER BY "legalScore" DESC LIMIT 10;'
```

기대 결과:

- TEST “패턴에 없는 사실적시”가 PASS — 이게 v3의 존재 이유
- “무해 + 돈 언급”이 FAIL(오탐)이어도 치명적이지 않음 (recall 우선). 단 기록해 둘 것
- 마지막 케이스가 오탐되면 NLI benign 게이트가 동작하는지 확인

-----

## CHECKLIST

- [ ] Comment 테이블 수정 없음 (불변 원칙 §5)
- [ ] 기존 마이그레이션 수정 없음 — 새 마이그레이션만 추가 (§5)
- [ ] classification: “reference_only” 모든 signal에 포함
- [ ] ruleVersion / modelVersion 모든 signal에 기록
- [ ] legal_score / ops_score = 코드 산출 (모델 직접 점수 금지)
- [ ] Ops / Legal Lane 상호 의존 없음 — Legal 예외가 Ops 저장을 막지 않음
- [ ] 사실적시 탐지 = 구성요건 분해 (문장 패턴 매칭 금지)
- [ ] 데이터셋은 centroid/캘리브레이션/평가셋 전용 — 분류기 학습 금지
- [ ] 평가셋은 centroid 생성에서 제외 (오염 방지)
- [ ] 라벨은 원자적 관측 사실만 (“악성”, “문제있음” 금지)
- [ ] requiresHumanReview ≥ 0.7
- [ ] 분류 실패가 수집을 실패시키지 않음
- [ ] GPT 도입 대비: calculate_legal_score 입력 스키마 불변, modelVersion으로 추적
- [ ] urgency/ops 점수를 파기·보관·법적 판단 근거로 사용하지 않음 (§11)