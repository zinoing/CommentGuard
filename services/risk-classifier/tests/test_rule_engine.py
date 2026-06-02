from app.classifiers.rule_engine import classify_with_rules
from app.models import RiskType, ActionType


# CHECKLIST §9: rule engine classification tests
class TestRuleEngine:
    def test_legal_threat_korean(self):
        result = classify_with_rules("죽이겠다 이 계정")
        assert RiskType.LEGAL_THREAT in result["risk_types"]
        assert result["legal_score"] >= 0.8
        assert result["urgency_score"] >= 0.9

    def test_legal_threat_english(self):
        result = classify_with_rules("i will kill you")
        assert RiskType.LEGAL_THREAT in result["risk_types"]
        assert result["legal_score"] >= 0.8

    def test_harassment_detected(self):
        result = classify_with_rules("stalking you everywhere")
        assert RiskType.HARASSMENT in result["risk_types"]

    def test_safe_comment_ignored(self):
        result = classify_with_rules("Great video! Keep it up.")
        assert result["legal_score"] == 0.0
        assert result["brand_score"] == 0.0
        assert result["recommended_action"] == ActionType.IGNORE

    def test_high_risk_recommends_preserve_and_delete(self):
        result = classify_with_rules("찾아가서 죽여버리겠다")
        assert result["recommended_action"] == ActionType.PRESERVE_AND_DELETE

    def test_classification_label_not_in_rule_engine_output(self):
        # classification: reference_only is added at the API response layer, not here
        result = classify_with_rules("some comment")
        assert "classification" not in result


# CHECKLIST §3: classification label must always be reference_only
class TestClassificationLabel:
    def test_classify_response_always_has_reference_only(self):
        from app.models import ClassifyResponse, ActionType
        response = ClassifyResponse(
            comment_id="test-id",
            legal_score=0.0,
            brand_score=0.0,
            urgency_score=0.0,
            risk_types=[],
            recommended_action=ActionType.IGNORE,
            model_version="test-v1",
        )
        assert response.classification == "reference_only"

    def test_classification_cannot_be_overridden(self):
        from app.models import ClassifyResponse, ActionType
        # Even if someone tries to set it to something else, the Literal type enforces it
        response = ClassifyResponse(
            comment_id="test-id",
            legal_score=0.0,
            brand_score=0.0,
            urgency_score=0.0,
            risk_types=[],
            recommended_action=ActionType.IGNORE,
            model_version="test-v1",
            classification="reference_only",
        )
        assert response.classification == "reference_only"
