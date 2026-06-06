import asyncio
import logging
import os
import subprocess
from datetime import datetime, timezone

import httpx
import yt_dlp

logger = logging.getLogger(__name__)

# DEV ONLY: limit video count when set (e.g. DEV_MAX_VIDEOS=3)
_DEV_MAX_VIDEOS = int(os.getenv("DEV_MAX_VIDEOS", "0")) or None


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
        ["yt-dlp", "--flat-playlist", "--print", "id", "--no-warnings", url],
        capture_output=True,
        text=True,
        timeout=120,
    )
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip() or "yt-dlp failed to list channel videos")
    return [line.strip() for line in r.stdout.splitlines() if line.strip()]


def _collect_comments_for_video(video_id: str) -> list[dict]:
    ydl_opts = {
        "getcomments": True,
        "skip_download": True,
        "quiet": True,
        "no_warnings": True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(
            f"https://www.youtube.com/watch?v={video_id}", download=False
        )
    raw_comments = (info or {}).get("comments") or []
    comments: list[dict] = []
    for idx, c in enumerate(raw_comments):
        ts = c.get("timestamp")
        created = (
            datetime.fromtimestamp(ts, tz=timezone.utc)
            if ts
            else datetime.now(tz=timezone.utc)
        )
        comments.append({
            "platform_comment_id": c.get("id") or f"{video_id}_{idx}",
            "text": c.get("text") or "",
            "author_id": c.get("author_id") or c.get("author") or "unknown",
            "created_at": created.isoformat(),
        })
    return comments


async def _post_callback(client: httpx.AsyncClient, callback_url: str, payload: dict) -> None:
    try:
        await client.post(callback_url, json=payload, timeout=30)
    except Exception as e:
        logger.warning("Callback POST failed url=%s: %s", callback_url, e)


async def collect_channel(job_id: str, channel_id: str, callback_url: str) -> None:
    async with httpx.AsyncClient() as client:
        try:
            try:
                video_ids = await asyncio.to_thread(_get_video_ids, channel_id)
            except Exception as e:
                await _post_callback(client, callback_url, {
                    "job_id": job_id,
                    "event": "failed",
                    "error": str(e)[:500],
                })
                return

            if _DEV_MAX_VIDEOS:
                video_ids = video_ids[:_DEV_MAX_VIDEOS]

            await _post_callback(client, callback_url, {
                "job_id": job_id,
                "event": "started",
                "total_videos": len(video_ids),
            })

            for video_id in video_ids:
                try:
                    comments = await asyncio.to_thread(_collect_comments_for_video, video_id)
                    await _post_callback(client, callback_url, {
                        "job_id": job_id,
                        "event": "video_done",
                        "video_id": video_id,
                        "comments": comments,
                    })
                except Exception as e:
                    logger.warning("Failed to process video %s: %s", video_id, e)
                    # 영상 1개 실패 시 continue (Job 전체 중단 금지)

            await _post_callback(client, callback_url, {
                "job_id": job_id,
                "event": "done",
            })

        except Exception as e:
            logger.error("collect_channel fatal error job=%s: %s", job_id, e)
            await _post_callback(client, callback_url, {
                "job_id": job_id,
                "event": "failed",
                "error": str(e)[:500],
            })
