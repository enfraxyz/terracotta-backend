# Terracotta Help

## Overview

Terracotta is a tool designed to assist with managing and reviewing Terraform code. It provides insights into best practices, security checks, and optimizations for your infrastructure as code.

## Commands

- **`tc:help`**: Displays this help message.
- **`tc:review`**: Initiates a review of the Terraform code in the current pull request.
- **`tc:plan`**: Runs a Terraform plan and provides feedback on potential issues.
- **`tc:drift`**: Initiates a drift report on the current state, which can be compared to the planned changes.

## Features

- **Terraform Code Review**: Analyze Terraform files for syntax, security, and best practices.
- **Security Checks**: Identify overly permissive IAM roles, public S3 buckets, and other security risks.
- **Optimization Suggestions**: Get recommendations for performance improvements and cost savings.
- **Risk Assessment**: Categorize issues by severity to prioritize fixes.

## How to Use

1. **Attach Terraform Files**: Include `.tf`, `.tfvars`, or `.tfstate` files in your pull request for analysis.
2. **Provide PR Diffs**: Share GitHub PR diffs or Terraform plan outputs for a detailed review.
3. **Ask for Checks**: Request specific checks or optimizations using the commands above.

## Need more help?

If you need more help, or would like to request a feature, please reach out to [support@tryterracotta.com](mailto:support@tryterracotta.com)
