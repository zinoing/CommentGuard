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

    def test_safe_comment_returns_none_action(self):
        result = classify_with_rules("Great video! Keep it up.")
        assert result["legal_score"] == 0.0
        assert result["brand_score"] == 0.0
        assert result["recommended_action"] is None

    def test_high_risk_recommends_legal_review(self):
        result = classify_with_rules("찾아가서 죽여버리겠다")
        assert result["recommended_action"] == ActionType.REQUEST_LEGAL_REVIEW

    def test_harassment_at_threshold_recommends_legal_review(self):
        # HARASSMENT sets legal_score = 0.7, which meets the >= 0.7 threshold
        result = classify_with_rules("stalking you everywhere")
        assert result["legal_score"] == 0.7
        assert result["recommended_action"] == ActionType.REQUEST_LEGAL_REVIEW

    def test_below_threshold_returns_none_action(self):
        # HATE_SPEECH sets legal_score = 0.6 — below threshold
        result = classify_with_rules("혐오 발언")
        assert result["legal_score"] == 0.6
        assert result["recommended_action"] is None

    def test_classification_label_not_in_rule_engine_output(self):
        # classification: reference_only is added at the API response layer, not here
        result = classify_with_rules("some comment")
        assert "classification" not in result

    def test_urgency_score_does_not_affect_action(self):
        # §11: urgency_score must never determine recommended_action
        # LEGAL_THREAT sets urgency=0.9 but action is driven by legal_score=0.85
        result = classify_with_rules("죽이겠다")
        assert result["urgency_score"] >= 0.9
        assert result["recommended_action"] == ActionType.REQUEST_LEGAL_REVIEW
        # Verify: a comment with high urgency but low legal score returns None
        spam_result = classify_with_rules("https://spam.com https://also-spam.com")
        assert spam_result["legal_score"] == 0.0
        assert spam_result["recommended_action"] is None


# CHECKLIST §3: classification label must always be reference_only
class TestClassificationLabel:
    def test_classify_response_always_has_reference_only(self):
        from app.models import ClassifyResponse
        response = ClassifyResponse(
            comment_id="test-id",
            legal_score=0.0,
            brand_score=0.0,
            urgency_score=0.0,
            risk_types=[],
            recommended_action=None,
            model_version="test-v1",
        )
        assert response.classification == "reference_only"

    def test_recommended_action_nullable(self):
        from app.models import ClassifyResponse
        response = ClassifyResponse(
            comment_id="test-id",
            legal_score=0.0,
            brand_score=0.0,
            urgency_score=0.0,
            risk_types=[],
            model_version="test-v1",
        )
        assert response.recommended_action is None

    def test_recommended_action_request_legal_review(self):
        from app.models import ClassifyResponse
        response = ClassifyResponse(
            comment_id="test-id",
            legal_score=0.85,
            brand_score=0.0,
            urgency_score=0.9,
            risk_types=[RiskType.LEGAL_THREAT],
            recommended_action=ActionType.REQUEST_LEGAL_REVIEW,
            model_version="test-v1",
        )
        assert response.recommended_action == ActionType.REQUEST_LEGAL_REVIEW
        assert response.classification == "reference_only"
