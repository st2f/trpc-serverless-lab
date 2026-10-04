resource "aws_lambda_function" "api" {
  function_name    = "trpc-lab-api"
  role             = aws_iam_role.api.arn
  runtime          = "nodejs24.x"
  handler          = "index.handler"
  filename         = "${path.module}/../../backend/dist/lambda.zip"
  source_code_hash = filebase64sha256("${path.module}/../../backend/dist/lambda.zip")
  memory_size      = 128
  timeout          = 10

  environment {
    variables = { NODE_ENV = "production" }
  }

  depends_on = [aws_iam_role_policy.logs]
}

resource "aws_apigatewayv2_api" "api" {
  name          = "trpc-lab-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = [var.frontend_origin]
    allow_methods = ["GET", "POST", "OPTIONS"]
    allow_headers = ["content-type"]
  }
}

resource "aws_apigatewayv2_integration" "api" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "api" {
  api_id = aws_apigatewayv2_api.api.id
  # Leave OPTIONS unmatched so API Gateway handles CORS preflight itself.
  route_key = "GET /{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.api.id}"
}

resource "aws_apigatewayv2_route" "api_post" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "POST /{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.api.id}"
}

resource "aws_lambda_permission" "gateway" {
  statement_id  = "AllowApiGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

resource "aws_apigatewayv2_stage" "api" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true
  depends_on = [
    aws_apigatewayv2_route.api,
    aws_apigatewayv2_route.api_post,
    aws_lambda_permission.gateway,
  ]
}
