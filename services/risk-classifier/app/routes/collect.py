import asyncio

from fastapi import APIRouter
from pydantic import BaseModel

from app.collectors.channel_collector import collect_channel

router = APIRouter()


class _StartRequest(BaseModel):
    job_id: str
    channel_id: str
    callback_url: str


@router.post("/collect/start")
async def collect_start(req: _StartRequest) -> dict:
    asyncio.create_task(collect_channel(req.job_id, req.channel_id, req.callback_url))
    return {"accepted": True}
