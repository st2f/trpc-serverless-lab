terraform {
  required_version = ">= 1.5, < 2.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

variable "aws_profile" {
  description = "Shared AWS CLI profile used for this deployment."
  type        = string
  default     = "default"
}

variable "aws_region" {
  type    = string
  default = "eu-north-1"
}

variable "aws_account_id" {
  description = "Expected AWS account; the provider refuses a different account."
  type        = string
  validation {
    condition     = can(regex("^[0-9]{12}$", var.aws_account_id))
    error_message = "Provide a 12-digit AWS account ID."
  }
}

variable "frontend_origin" {
  description = "Browser origin allowed to call the API."
  type        = string
  default     = "http://localhost:5173"
}

# Real AWS credentials and endpoints; independent of the MiniStack root/state.
provider "aws" {
  profile             = var.aws_profile
  region              = var.aws_region
  allowed_account_ids = [var.aws_account_id]

  default_tags {
    tags = { Project = "trpc-serverless-lab" }
  }
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/trpc-lab-api"
  retention_in_days = 7
}

resource "aws_iam_role" "api" {
  name = "trpc-lab-api"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "logs" {
  name = "lambda-logs"
  role = aws_iam_role.api.id
  # Terraform creates the group; Lambda only needs to create streams/write logs.
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
      Resource = "${aws_cloudwatch_log_group.api.arn}:*"
    }]
  })
}
