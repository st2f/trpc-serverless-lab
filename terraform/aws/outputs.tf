output "api_url" {
  description = "AWS tRPC base URL; the default stage needs no stage segment."
  value       = aws_apigatewayv2_api.api.api_endpoint
}

output "frontend_origin" {
  value = var.frontend_origin
}

output "api_function_name" {
  value = aws_lambda_function.api.function_name
}

output "log_group_name" {
  value = aws_cloudwatch_log_group.api.name
}

output "aws_region" {
  value = var.aws_region
}
