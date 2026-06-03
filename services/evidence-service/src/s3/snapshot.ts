import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT_URL,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const EVIDENCE_BUCKET = process.env.R2_BUCKET_NAME!;

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
