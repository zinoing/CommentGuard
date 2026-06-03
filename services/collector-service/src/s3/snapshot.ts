import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";

// R2 is S3-compatible; endpoint_url points to the R2 bucket endpoint
const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT_URL,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const EVIDENCE_BUCKET = process.env.R2_BUCKET_NAME!;

export interface SnapshotResult {
  r2Key: string;
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

  const r2Key = `snapshots/${channelId}/${platformCommentId}/${Date.now()}.json`;

  await s3.send(
    new PutObjectCommand({
      Bucket: EVIDENCE_BUCKET,
      Key: r2Key,
      Body: payload,
      ContentType: "application/json",
    })
  );

  return { r2Key, sha256Hash };
}

export class SnapshotHashMismatchError extends Error {
  constructor(r2Key: string) {
    super(`Snapshot hash mismatch for key: ${r2Key}`);
    this.name = "SnapshotHashMismatchError";
  }
}

// CHECKLIST §1: hash verified on every read (not just on write)
export async function readAndVerifySnapshot(
  r2Key: string,
  expectedHash: string
): Promise<Record<string, unknown>> {
  const response = await s3.send(
    new GetObjectCommand({ Bucket: EVIDENCE_BUCKET, Key: r2Key })
  );

  const body = await response.Body!.transformToString("utf-8");
  const actualHash = crypto.createHash("sha256").update(body).digest("hex");

  if (actualHash !== expectedHash) {
    throw new SnapshotHashMismatchError(s3Key);
  }

  return JSON.parse(body);
}
