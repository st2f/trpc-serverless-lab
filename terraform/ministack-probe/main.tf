terraform {
  required_version = ">= 1.5, < 2.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

# This root is deliberately local-only. All used AWS services are redirected.
provider "aws" {
  region                      = "us-east-1"
  access_key                  = "test"
  secret_key                  = "test"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true

  endpoints {
    apigateway   = "http://localhost:4566"
    apigatewayv2 = "http://localhost:4566"
    iam          = "http://localhost:4566"
    lambda       = "http://localhost:4566"
    sts          = "http://localhost:4566"
  }
}

resource "aws_iam_role" "probe" {
  name = "trpc-lab-ministack-probe"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_lambda_function" "probe" {
  function_name    = "trpc-lab-ministack-probe"
  role             = aws_iam_role.probe.arn
  runtime          = "nodejs24.x"
  handler          = "index.handler"
  filename         = "${path.module}/../../backend/dist/probe.zip"
  source_code_hash = filebase64sha256("${path.module}/../../backend/dist/probe.zip")
  timeout          = 10
}

resource "aws_apigatewayv2_api" "probe" {
  name          = "trpc-lab-local"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = [var.frontend_origin]
    allow_methods = ["GET", "POST", "OPTIONS"]
    allow_headers = ["content-type"]
  }
}

resource "aws_apigatewayv2_integration" "probe" {
  api_id                 = aws_apigatewayv2_api.probe.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.probe.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "probe" {
  api_id    = aws_apigatewayv2_api.probe.id
  route_key = "ANY /probe"
  target    = "integrations/${aws_apigatewayv2_integration.probe.id}"
}

resource "aws_lambda_permission" "gateway" {
  statement_id  = "AllowApiGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.probe.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.probe.execution_arn}/*/*"
}

resource "aws_apigatewayv2_stage" "probe" {
  api_id      = aws_apigatewayv2_api.probe.id
  name        = "$default"
  auto_deploy = true
  depends_on = [
    aws_apigatewayv2_route.probe,
    aws_apigatewayv2_route.api,
    aws_lambda_permission.gateway,
    aws_lambda_permission.api,
  ]
}

output "probe_url" {
  description = "MiniStack's documented path-based HTTP API endpoint."
  value       = "http://localhost:4566/_aws/execute-api/${aws_apigatewayv2_api.probe.id}/probe"
}

output "function_name" {
  value = aws_lambda_function.probe.function_name
}

output "api_id" {
  value = aws_apigatewayv2_api.probe.id
}
