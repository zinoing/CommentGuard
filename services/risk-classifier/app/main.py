from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from app.routes.classify import router as classify_router
from app.routes.feedback import router as feedback_router
from app.routes.audit import router as audit_router

app = FastAPI(title="CommentGuard Risk Classifier", version="1.0.0")

# CHECKLIST §6: error responses must not leak internal stack traces
@app.exception_handler(Exception)
async def global_exception_handler(_request: Request, _exc: Exception):
    return JSONResponse(status_code=500, content={"error": "Internal server error"})

app.include_router(classify_router, prefix="/api/v1")
app.include_router(feedback_router, prefix="/api/v1")
app.include_router(audit_router, prefix="/api/v1")


@app.get("/health")
def health():
    return {"status": "ok", "service": "risk-classifier"}
