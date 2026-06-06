import asyncio
import logging
import os
import subprocess
import uuid
from datetime import datetime, timezone

import psycopg2
import yt_dlp

logger = logging.getLogger(__name__)

_DATABASE_URL = os.getenv("DATABASE_URL")


def _get_conn():
    return psycopg2.connect(_DATABASE_URL)


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
            "id": c.get("id") or f"{video_id}_{idx}",
            "text": c.get("text") or "",
            "author_id": c.get("author_id") or c.get("author") or "unknown",
            "created_at": created,
        })
    return comments


def _channel_display_name(channel_id: str) -> str:
    if channel_id.startswith("http"):
        last = channel_id.rstrip("/").split("/")[-1]
        return last.lstrip("@") or channel_id
    return channel_id.lstrip("@")


def _get_or_create_channel(platform_channel_id: str) -> str:
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                'SELECT id FROM "Channel" WHERE platform = %s AND "platformChannelId" = %s',
                ("YOUTUBE", platform_channel_id),
            )
            row = cur.fetchone()
            if row:
                return row[0]

            # Get or create a default tenant
            cur.execute('SELECT id FROM "Tenant" LIMIT 1')
            tenant_row = cur.fetchone()
            if tenant_row:
                tenant_id = tenant_row[0]
            else:
                tenant_id = str(uuid.uuid4())
                cur.execute(
                    'INSERT INTO "Tenant" (id, name, "updatedAt") VALUES (%s, %s, NOW())',
                    (tenant_id, "Default"),
                )

            # Create the channel
            channel_id = str(uuid.uuid4())
            cur.execute(
                '''
                INSERT INTO "Channel"
                    (id, platform, "platformChannelId", name, "tenantId", "apiCredentialsRef", "updatedAt")
                VALUES (%s, 'YOUTUBE', %s, %s, %s, 'collect', NOW())
                ON CONFLICT (platform, "platformChannelId") DO NOTHING
                ''',
                (channel_id, platform_channel_id, _channel_display_name(platform_channel_id), tenant_id),
            )
            # Re-fetch in case another process created it first
            cur.execute(
                'SELECT id FROM "Channel" WHERE platform = %s AND "platformChannelId" = %s',
                ("YOUTUBE", platform_channel_id),
            )
            return cur.fetchone()[0]


def _upsert_comments(channel_internal_id: str, comments: list[dict]) -> int:
    if not comments:
        return 0
    inserted = 0
    with _get_conn() as conn:
        with conn.cursor() as cur:
            for c in comments:
                cur.execute(
                    '''
                    INSERT INTO "Comment"
                        (id, "channelId", "platformCommentId", text, "authorPlatformId", "createdAt")
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT ("channelId", "platformCommentId") DO NOTHING
                    ''',
                    (
                        str(uuid.uuid4()),
                        channel_internal_id,
                        c["id"],
                        c["text"],
                        c["author_id"],
                        c["created_at"],
                    ),
                )
                if cur.rowcount > 0:
                    inserted += 1
    return inserted


def _update_job(job_id: str, **fields) -> None:
    if not fields:
        return
    parts = [f'"{k}" = %s' for k in fields]
    parts.append('"updatedAt" = NOW()')
    values = list(fields.values())
    values.append(job_id)
    sql = f'UPDATE "CollectJob" SET {", ".join(parts)} WHERE "id" = %s'
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, values)


async def collect_channel(job_id: str, channel_id: str) -> None:
    try:
        await asyncio.to_thread(_update_job, job_id, status="RUNNING")

        try:
            video_ids = await asyncio.to_thread(_get_video_ids, channel_id)
        except Exception as e:
            await asyncio.to_thread(_update_job, job_id, status="FAILED", errorMessage=str(e)[:500])
            return

        await asyncio.to_thread(_update_job, job_id, totalVideos=len(video_ids))

        channel_internal_id = await asyncio.to_thread(_get_or_create_channel, channel_id)

        processed = 0
        total_comments = 0

        for video_id in video_ids:
            try:
                comments = await asyncio.to_thread(_collect_comments_for_video, video_id)
                if channel_internal_id and comments:
                    inserted = await asyncio.to_thread(_upsert_comments, channel_internal_id, comments)
                    total_comments += inserted
            except Exception as e:
                logger.warning("Failed to process video %s: %s", video_id, e)
                # Single video failure does not abort the job (CHECKLIST)
            finally:
                processed += 1
                await asyncio.to_thread(
                    _update_job,
                    job_id,
                    processedVideos=processed,
                    totalComments=total_comments,
                )

        await asyncio.to_thread(_update_job, job_id, status="DONE")

    except Exception as e:
        logger.error("collect_channel fatal error job=%s: %s", job_id, e)
        try:
            await asyncio.to_thread(_update_job, job_id, status="FAILED", errorMessage=str(e)[:500])
        except Exception:
            pass
