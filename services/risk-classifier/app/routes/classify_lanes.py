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
