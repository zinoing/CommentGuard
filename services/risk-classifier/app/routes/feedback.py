from fastapi import APIRouter
from app.models import FeedbackRequest

router = APIRouter()


@router.post("/feedback")
async def submit_feedback(req: FeedbackRequest):
    # CHECKLIST §9: misclassification correction routes to retraining queue
    # In production: publish to Kafka topic "classifier-feedback"
    print(f"Feedback queued for comment {req.comment_id}: {req.corrected_risk_types}")
    return {"status": "queued", "comment_id": req.comment_id}
