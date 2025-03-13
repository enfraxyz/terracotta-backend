#!/bin/bash
# Install Terraform
wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
unzip terraform_1.6.0_linux_amd64.zip
chmod +x terraform
mv terraform /usr/local/bin/

echo "Installing dependencies..."
npm install