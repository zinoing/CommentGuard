-- CHECKLIST §5: new migration — existing migrations are never modified

-- Add optional fields to Channel for OAuth and MCN linkage
ALTER TABLE "Channel" ADD COLUMN "mcnId"             TEXT;
ALTER TABLE "Channel" ADD COLUMN "oauthAccessToken"  TEXT;
ALTER TABLE "Channel" ADD COLUMN "oauthRefreshToken" TEXT;
ALTER TABLE "Channel" ADD COLUMN "lastCollectedAt"   TIMESTAMP(3);

-- CreateEnum: invite lifecycle
CREATE TYPE "ChannelInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED');

-- CreateTable: MCN → creator channel invite links
CREATE TABLE "ChannelInvite" (
    "id"          TEXT                    NOT NULL,
    "mcnId"       TEXT                    NOT NULL,
    "channelName" TEXT                    NOT NULL,
    "token"       TEXT                    NOT NULL,
    "status"      "ChannelInviteStatus"   NOT NULL DEFAULT 'PENDING',
    "expiresAt"   TIMESTAMP(3)            NOT NULL,
    "createdAt"   TIMESTAMP(3)            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChannelInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChannelInvite_token_key" ON "ChannelInvite"("token");
