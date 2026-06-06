import asyncio
import os
import uuid

import psycopg2
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.collectors.channel_collector import collect_channel

router = APIRouter()

_DATABASE_URL = os.getenv("DATABASE_URL")


class _StartRequest(BaseModel):
    channel_id: str


class _StatusResponse(BaseModel):
    job_id: str
    status: str
    totalVideos: int
    processedVideos: int
    totalComments: int
    errorMessage: str | None = None


def _create_job(channel_id: str) -> str:
    job_id = str(uuid.uuid4())
    with psycopg2.connect(_DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(
                '''
                INSERT INTO "CollectJob"
                    (id, "channelId", status, "totalVideos", "processedVideos", "totalComments", "updatedAt")
                VALUES (%s, %s, 'PENDING', 0, 0, 0, NOW())
                ''',
                (job_id, channel_id),
            )
    return job_id


def _get_job(job_id: str) -> dict | None:
    with psycopg2.connect(_DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(
                '''
                SELECT id, status, "totalVideos", "processedVideos", "totalComments", "errorMessage"
                FROM "CollectJob"
                WHERE id = %s
                ''',
                (job_id,),
            )
            row = cur.fetchone()
    if not row:
        return None
    return {
        "job_id": row[0],
        "status": row[1],
        "totalVideos": row[2],
        "processedVideos": row[3],
        "totalComments": row[4],
        "errorMessage": row[5],
    }


@router.post("/collect/start")
async def collect_start(req: _StartRequest) -> dict:
    if not _DATABASE_URL:
        raise HTTPException(status_code=500, detail="DATABASE_URL not configured")
    try:
        job_id = await asyncio.to_thread(_create_job, req.channel_id)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to create collect job")

    asyncio.create_task(collect_channel(job_id, req.channel_id))
    return {"job_id": job_id}


@router.get("/collect/status/{job_id}", response_model=_StatusResponse)
async def collect_status(job_id: str) -> _StatusResponse:
    if not _DATABASE_URL:
        raise HTTPException(status_code=500, detail="DATABASE_URL not configured")
    job = await asyncio.to_thread(_get_job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return _StatusResponse(**job)
