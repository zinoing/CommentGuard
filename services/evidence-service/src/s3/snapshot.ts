import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? "ap-northeast-2",
  endpoint: process.env.AWS_ENDPOINT_URL,
  forcePathStyle: !!process.env.AWS_ENDPOINT_URL,
});

const EVIDENCE_BUCKET = process.env.S3_EVIDENCE_BUCKET!;

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
