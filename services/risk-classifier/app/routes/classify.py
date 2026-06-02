from fastapi import APIRouter
from app.models import ClassifyRequest, ClassifyResponse, ActionType
from app.classifiers.rule_engine import classify_with_rules
from app.classifiers.ml_classifier import classify_with_ml, MODEL_VERSION
import os

router = APIRouter()


@router.post("/classify", response_model=ClassifyResponse)
async def classify_comment(req: ClassifyRequest) -> ClassifyResponse:
    rule_result = classify_with_rules(req.text)

    # Rule engine overrides ML for high-confidence legal keyword matches
    if rule_result["legal_score"] >= 0.8:
        return ClassifyResponse(
            comment_id=req.comment_id,
            legal_score=rule_result["legal_score"],
            brand_score=rule_result["brand_score"],
            urgency_score=rule_result["urgency_score"],
            risk_types=rule_result["risk_types"],
            recommended_action=rule_result["recommended_action"],
            model_version=f"rule-engine-v1+{MODEL_VERSION}",
            classification="reference_only",
        )

    ml_result = await classify_with_ml(req.text)

    # Merge: take max scores between rule engine and ML
    final_legal = max(rule_result["legal_score"], ml_result["legal_score"])
    final_brand = max(rule_result["brand_score"], ml_result["brand_score"])
    final_urgency = max(rule_result["urgency_score"], ml_result["urgency_score"])
    final_risk_types = list(set(rule_result["risk_types"] + ml_result["risk_types"]))

    final_action = ActionType.IGNORE
    if final_legal >= 0.8 or final_urgency >= 0.9:
        final_action = ActionType.PRESERVE_AND_DELETE
    elif final_legal >= 0.5:
        final_action = ActionType.HIDE

    return ClassifyResponse(
        comment_id=req.comment_id,
        legal_score=final_legal,
        brand_score=final_brand,
        urgency_score=final_urgency,
        risk_types=final_risk_types,
        recommended_action=final_action,
        model_version=ml_result["model_version"],
        classification="reference_only",
    )
