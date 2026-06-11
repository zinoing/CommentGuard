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
