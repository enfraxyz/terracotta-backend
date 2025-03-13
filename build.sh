#!/bin/bash
set -e  # Exit if any command fails

# Define Terraform version
TERRAFORM_VERSION="1.11.2"  # Change this if needed

# Create a bin directory in home if not exists
mkdir -p "$HOME/bin"

# Download Terraform binary
curl -fsSL -o "$HOME/bin/terraform.zip" "https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_amd64.zip"

# Unzip Terraform binary with -o to overwrite without prompts
cd "$HOME/bin"
unzip -o terraform.zip
rm terraform.zip

# Make Terraform executable
chmod +x "$HOME/bin/terraform"

# Add Terraform to PATH for the current session
export PATH="$HOME/bin:$PATH"

# Verify installation
terraform --version