# DEV ONLY — remove before GA
import asyncio
import json
import subprocess
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()




class _DevCollectRequest(BaseModel):
    channel_id: str


class _DevComment(BaseModel):
    comment_id: str
    video_id: str
    parent: str  # "root" for top-level, parent comment_id for replies
    text: str
    author_id: str
    created_at: datetime
    legal_score: None = None
    brand_score: None = None
    urgency_score: None = None
    risk_types: list = []
    recommended_action: None = None
    classification: str = "reference_only"


class _DevCollectResponse(BaseModel):
    channel_id: str
    video_id: str
    collected_at: datetime
    comments: list[_DevComment]


def _check_ytdlp() -> bool:
    try:
        r = subprocess.run(["yt-dlp", "--version"], capture_output=True)
        return r.returncode == 0
    except FileNotFoundError:
        return False


def _channel_to_url(channel_id: str) -> str:
    if channel_id.startswith("http"):
        return channel_id
    if channel_id.startswith("UC"):
        return f"https://www.youtube.com/channel/{channel_id}"
    handle = channel_id.lstrip("@")
    return f"https://www.youtube.com/@{handle}"


def _get_video_ids(channel_id: str) -> list[str]:
    url = _channel_to_url(channel_id)
    r = subprocess.run(
        [
            "yt-dlp",
            "--flat-playlist",
            "--playlist-end", "1",
            "--print", "id",
            "--no-warnings",
            url,
        ],
        capture_output=True,
        text=True,
    )
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip() or "yt-dlp failed to list channel videos")
    return [line.strip() for line in r.stdout.splitlines() if line.strip()]


def _collect_comments_for_video(video_id: str) -> list[_DevComment]:
    r = subprocess.run(
        [
            "yt-dlp",
            "--skip-download",
            "--write-comments",
            "--no-write-info-json",
            "-j",
            "--no-warnings",
            f"https://www.youtube.com/watch?v={video_id}",
        ],
        capture_output=True,
        text=True,
        timeout=60,
    )

    comments: list[_DevComment] = []
    for line in r.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            data = json.loads(line)
        except json.JSONDecodeError:
            continue

        for idx, c in enumerate(data.get("comments", [])):
            ts = c.get("timestamp")
            created = (
                datetime.fromtimestamp(ts, tz=timezone.utc)
                if ts
                else datetime.now(tz=timezone.utc)
            )
            comments.append(
                _DevComment(
                    comment_id=c.get("id") or f"{video_id}_{idx}",
                    video_id=video_id,
                    parent=c.get("parent") or "root",
                    text=c.get("text") or "",
                    author_id=c.get("author_id") or c.get("author") or "unknown",
                    created_at=created,
                )
            )

    return comments


@router.post("/dev/collect", response_model=_DevCollectResponse)
async def dev_collect(req: _DevCollectRequest) -> _DevCollectResponse:
    if not await asyncio.to_thread(_check_ytdlp):
        raise HTTPException(
            status_code=500,
            detail="yt-dlp not found. Run: pip install yt-dlp",
        )

    try:
        video_ids = await asyncio.to_thread(_get_video_ids, req.channel_id)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not video_ids:
        raise HTTPException(status_code=400, detail="No videos found for this channel")

    # defense: only process the first video
    video_id = video_ids[:1][0]

    comments = await asyncio.to_thread(_collect_comments_for_video, video_id)

    return _DevCollectResponse(
        channel_id=req.channel_id,
        video_id=video_id,
        collected_at=datetime.now(tz=timezone.utc),
        comments=comments,
    )
