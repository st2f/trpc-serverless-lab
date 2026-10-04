variable "frontend_origin" {
  description = "Browser origin allowed to call the local HTTP API."
  type        = string
  default     = "http://localhost:5173"
}

# Both stateless functions share the local execution role and HTTP API.
resource "aws_lambda_function" "api" {
  function_name    = "trpc-lab-api"
  role             = aws_iam_role.probe.arn
  runtime          = "nodejs24.x"
  handler          = "index.handler"
  filename         = "${path.module}/../../backend/dist/lambda.zip"
  source_code_hash = filebase64sha256("${path.module}/../../backend/dist/lambda.zip")
  timeout          = 10

  environment {
    variables = { NODE_ENV = "production" }
  }
}

resource "aws_apigatewayv2_integration" "api" {
  api_id                 = aws_apigatewayv2_api.probe.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "api" {
  api_id    = aws_apigatewayv2_api.probe.id
  route_key = "ANY /{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.api.id}"
}

resource "aws_lambda_permission" "api" {
  statement_id  = "AllowApiGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.probe.execution_arn}/*/*"
}

output "api_url" {
  description = "Local base URL for tRPC API procedures."
  value       = "http://localhost:4566/_aws/execute-api/${aws_apigatewayv2_api.probe.id}"
}

output "frontend_origin" {
  value = var.frontend_origin
}

output "api_function_name" {
  value = aws_lambda_function.api.function_name
}
