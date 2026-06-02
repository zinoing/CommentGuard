import os
from openai import AsyncOpenAI
from app.models import RiskType, ActionType

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

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
- recommended_action: one of ["IGNORE", "HIDE", "DELETE", "PRESERVE_AND_DELETE"]

IMPORTANT: This is for reference only and must not be used as a legal determination."""

MODEL_VERSION = "gpt-4o-2024-05-13"


async def classify_with_ml(text: str) -> dict:
    try:
        response = await client.chat.completions.create(
            model=MODEL_VERSION,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Comment: {text}"},
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
        )
        import json
        result = json.loads(response.choices[0].message.content)
        return {
            "legal_score": float(result.get("legal_score", 0.0)),
            "brand_score": float(result.get("brand_score", 0.0)),
            "urgency_score": float(result.get("urgency_score", 0.0)),
            "risk_types": [RiskType(rt) for rt in result.get("risk_types", []) if rt in RiskType.__members__],
            "recommended_action": ActionType(result.get("recommended_action", "IGNORE")),
            "model_version": MODEL_VERSION,
        }
    except Exception:
        # Fallback returns empty - caller should use rule engine
        return {
            "legal_score": 0.0,
            "brand_score": 0.0,
            "urgency_score": 0.0,
            "risk_types": [],
            "recommended_action": ActionType.IGNORE,
            "model_version": MODEL_VERSION,
        }
