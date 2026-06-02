terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {
    bucket = "commentguard-terraform-state"
    key    = "prod/terraform.tfstate"
    region = "ap-northeast-2"
  }
}

provider "aws" {
  region = "ap-northeast-2"
}

# KMS key for evidence file encryption (CHECKLIST §10)
resource "aws_kms_key" "evidence" {
  description             = "CommentGuard evidence file encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

# S3 bucket with Object Lock — WORM Compliance Mode (CHECKLIST §1)
resource "aws_s3_bucket" "evidence" {
  bucket = "commentguard-evidence-${var.environment}"

  object_lock_enabled = true
}

resource "aws_s3_bucket_object_lock_configuration" "evidence" {
  bucket = aws_s3_bucket.evidence.id

  rule {
    default_retention {
      mode = "COMPLIANCE"
      days = 30
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "evidence" {
  bucket = aws_s3_bucket.evidence.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.evidence.arn
    }
  }
}

# Block all public access to evidence bucket
resource "aws_s3_bucket_public_access_block" "evidence" {
  bucket = aws_s3_bucket.evidence.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

variable "environment" {
  default = "prod"
}
