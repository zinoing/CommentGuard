from pydantic import BaseModel, Field
from enum import Enum
from typing import Literal
import datetime


class RiskType(str, Enum):
    LEGAL_THREAT = "LEGAL_THREAT"
    HATE_SPEECH = "HATE_SPEECH"
    HARASSMENT = "HARASSMENT"
    SPAM = "SPAM"
    COORDINATED_ATTACK = "COORDINATED_ATTACK"


class ActionType(str, Enum):
    IGNORE = "IGNORE"
    HIDE = "HIDE"
    DELETE = "DELETE"
    PRESERVE_AND_DELETE = "PRESERVE_AND_DELETE"


class ClassifyRequest(BaseModel):
    comment_id: str
    text: str
    author_platform_id: str
    channel_id: str
    created_at: datetime.datetime


# CHECKLIST §3: classification field always "reference_only"
class ClassifyResponse(BaseModel):
    comment_id: str
    legal_score: float = Field(ge=0.0, le=1.0)
    brand_score: float = Field(ge=0.0, le=1.0)
    urgency_score: float = Field(ge=0.0, le=1.0)
    risk_types: list[RiskType]
    recommended_action: ActionType
    model_version: str
    classification: Literal["reference_only"] = "reference_only"
    is_provisional: bool = False


class FeedbackRequest(BaseModel):
    comment_id: str
    risk_assessment_id: str
    corrected_risk_types: list[RiskType]
    corrected_action: ActionType
    reviewer_id: str
