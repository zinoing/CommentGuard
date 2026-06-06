import hashlib
import os
import httpx
from openai import AsyncOpenAI
from app.models import RiskType, ActionType
from dotenv import load_dotenv

load_dotenv()

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    return _client

SYSTEM_PROMPT = """You are a legal risk classifier for online comments. Classify the given comment for:
1. Legal threats (threats, doxxing, stalking)
2. Hate speech
3. Harassment
4. Spam

Respond in JSON with fields:
- legal_score (0.0-1.0)
- brand_score (0.0-1.0)
- urgency_score (0.0-1.0)
- risk_types: array of ["LEGAL_THREAT", "HATE_SPEECH", "HARASSMENT", "SPAM", "COORDINATED_ATTACK"]
- recommended_action: "REQUEST_LEGAL_REVIEW" if legal review is warranted, otherwise null

IMPORTANT: This is for reference only and must not be used as a legal determination."""

GPT_MODEL_VERSION = "gpt-4o-2024-05-13"

# CHECKLIST §9: identical comment text must not trigger a new API call
# In-memory cache keyed by SHA-256 of the comment text
# Phase 3+: replace with Redis for persistence across restarts
_cache: dict[str, dict] = {}


def _cache_key(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _parse_recommended_action(value: object) -> ActionType | None:
    if value == "REQUEST_LEGAL_REVIEW":
        return ActionType.REQUEST_LEGAL_REVIEW
    return None


async def _classify_with_kobert(text: str) -> dict | None:
    """
    Calls an external KoBERT/KoELECTRA inference endpoint if KOBERT_URL is configured.
    Returns None if the endpoint is unavailable — caller falls back to GPT-4o.

    Expected response schema from the KoBERT service:
      { "legal_score": float, "brand_score": float, "urgency_score": float,
        "risk_types": [...], "recommended_action": "REQUEST_LEGAL_REVIEW" | null,
        "model_version": str }
    """
    url = os.getenv("KOBERT_URL")
    if not url:
        return None

    try:
        async with httpx.AsyncClient(timeout=5.0) as http:
            resp = await http.post(f"{url}/classify", json={"text": text})
            resp.raise_for_status()
            data = resp.json()
            return {
                "legal_score": float(data.get("legal_score", 0.0)),
                "brand_score": float(data.get("brand_score", 0.0)),
                "urgency_score": float(data.get("urgency_score", 0.0)),
                "risk_types": [RiskType(rt) for rt in data.get("risk_types", []) if rt in RiskType.__members__],
                "recommended_action": _parse_recommended_action(data.get("recommended_action")),
                "model_version": data.get("model_version", "kobert-unknown"),
            }
    except Exception:
        return None


async def classify_with_ml(text: str) -> dict:
    key = _cache_key(text)
    if key in _cache:
        return _cache[key]

    # CHECKLIST §9: Korean-language comments route through KoBERT before GPT-4o
    result = await _classify_with_kobert(text)

    if result is None:
        result = await _classify_with_gpt4o(text)

    _cache[key] = result
    return result


async def _classify_with_gpt4o(text: str) -> dict:
    try:
        response = await _get_client().chat.completions.create(
            model=GPT_MODEL_VERSION,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Comment: {text}"},
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
        )
        import json
        data = json.loads(response.choices[0].message.content)
        return {
            "legal_score": float(data.get("legal_score", 0.0)),
            "brand_score": float(data.get("brand_score", 0.0)),
            "urgency_score": float(data.get("urgency_score", 0.0)),
            "risk_types": [RiskType(rt) for rt in data.get("risk_types", []) if rt in RiskType.__members__],
            "recommended_action": _parse_recommended_action(data.get("recommended_action")),
            "model_version": GPT_MODEL_VERSION,
        }
    except Exception:
        return {
            "legal_score": 0.0,
            "brand_score": 0.0,
            "urgency_score": 0.0,
            "risk_types": [],
            "recommended_action": None,
            "model_version": GPT_MODEL_VERSION,
        }
