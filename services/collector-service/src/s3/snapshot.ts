import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? "ap-northeast-2",
  endpoint: process.env.AWS_ENDPOINT_URL, // LocalStack in dev
  forcePathStyle: !!process.env.AWS_ENDPOINT_URL,
});

const EVIDENCE_BUCKET = process.env.S3_EVIDENCE_BUCKET!;

export interface SnapshotResult {
  s3Key: string;
  sha256Hash: string;
}

// CHECKLIST §1: snapshot written to S3 before any classification runs
// Hash computed at ingest and stored separately from the file
export async function writeCommentSnapshot(
  channelId: string,
  platformCommentId: string,
  rawData: Record<string, unknown>
): Promise<SnapshotResult> {
  const payload = JSON.stringify(rawData);
  const sha256Hash = crypto.createHash("sha256").update(payload).digest("hex");

  const s3Key = `snapshots/${channelId}/${platformCommentId}/${Date.now()}.json`;

  await s3.send(
    new PutObjectCommand({
      Bucket: EVIDENCE_BUCKET,
      Key: s3Key,
      Body: payload,
      ContentType: "application/json",
      // Object Lock is configured at the bucket level (WORM, Compliance Mode)
      // 30-day minimum retention enforced via bucket policy
    })
  );

  return { s3Key, sha256Hash };
}

export class SnapshotHashMismatchError extends Error {
  constructor(s3Key: string) {
    super(`Snapshot hash mismatch for key: ${s3Key}`);
    this.name = "SnapshotHashMismatchError";
  }
}

// CHECKLIST §1: hash verified on every read (not just on write)
export async function readAndVerifySnapshot(
  s3Key: string,
  expectedHash: string
): Promise<Record<string, unknown>> {
  const response = await s3.send(
    new GetObjectCommand({ Bucket: EVIDENCE_BUCKET, Key: s3Key })
  );

  const body = await response.Body!.transformToString("utf-8");
  const actualHash = crypto.createHash("sha256").update(body).digest("hex");

  if (actualHash !== expectedHash) {
    throw new SnapshotHashMismatchError(s3Key);
  }

  return JSON.parse(body);
}
