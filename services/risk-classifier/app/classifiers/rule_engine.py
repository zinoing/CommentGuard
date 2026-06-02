import re
from app.models import RiskType, ActionType

# Legal statute keywords (Korean + English)
LEGAL_THREAT_KEYWORDS = [
    "협박", "죽이겠다", "죽여버리겠다", "신상털겠다", "찾아가겠다",
    "고소", "법적조치", "죽어", "살해",
    "i will kill", "i'll find you", "i know where you live",
    "you're dead", "threat", "doxxing",
]

HATE_SPEECH_KEYWORDS = [
    "혐오", "차별", "특정집단", "인종차별",
]

HARASSMENT_KEYWORDS = [
    "스토킹", "따라다니겠다", "매일", "집 앞에",
    "stalking", "following you",
]

SPAM_PATTERNS = [
    r"https?://\S+\s*https?://\S+",  # Multiple URLs
    r"(.{5,})\1{3,}",  # Repeated text
    r"💰|무료|공짜|클릭|구독|팔로우.{0,10}맞팔",  # Spam solicitations
]


def classify_with_rules(text: str) -> dict:
    text_lower = text.lower()
    risk_types = []
    legal_score = 0.0
    brand_score = 0.0
    urgency_score = 0.0

    for keyword in LEGAL_THREAT_KEYWORDS:
        if keyword in text_lower:
            risk_types.append(RiskType.LEGAL_THREAT)
            legal_score = max(legal_score, 0.85)
            urgency_score = max(urgency_score, 0.9)
            break

    for keyword in HATE_SPEECH_KEYWORDS:
        if keyword in text_lower:
            risk_types.append(RiskType.HATE_SPEECH)
            legal_score = max(legal_score, 0.6)
            brand_score = max(brand_score, 0.7)
            break

    for keyword in HARASSMENT_KEYWORDS:
        if keyword in text_lower:
            risk_types.append(RiskType.HARASSMENT)
            legal_score = max(legal_score, 0.7)
            urgency_score = max(urgency_score, 0.8)
            break

    for pattern in SPAM_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            risk_types.append(RiskType.SPAM)
            brand_score = max(brand_score, 0.5)
            break

    recommended_action = ActionType.IGNORE
    if legal_score >= 0.8 or urgency_score >= 0.9:
        recommended_action = ActionType.PRESERVE_AND_DELETE
    elif legal_score >= 0.5:
        recommended_action = ActionType.HIDE
    elif brand_score >= 0.5:
        recommended_action = ActionType.HIDE

    return {
        "risk_types": list(set(risk_types)),
        "legal_score": legal_score,
        "brand_score": brand_score,
        "urgency_score": urgency_score,
        "recommended_action": recommended_action,
    }
