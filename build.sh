#!/bin/bash
set -e  # Exit if any command fails

echo "Creating bin directory in HOME"
mkdir -p $HOME/bin

echo "Downloading Terraform..."
wget -q -O terraform.zip https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip

echo "Unzipping Terraform..."
unzip terraform.zip

echo "Moving Terraform to HOME/bin"
mv terraform $HOME/bin/

echo "Setting permissions"
chmod +x $HOME/bin/terraform

echo "Ensuring bin directory contains Terraform"
ls -l $HOME/bin  # Debugging - Show files in $HOME/bin

echo "Updating PATH for current session"
export PATH="$HOME/bin:$PATH"
echo "Current PATH: $PATH"  # Debugging - Show updated PATH

echo "Updating PATH permanently"
echo 'export PATH="$HOME/bin:$PATH"' >> $HOME/.bashrc
echo 'export PATH="$HOME/bin:$PATH"' >> $HOME/.profile

echo "Verifying Terraform installation"
$HOME/bin/terraform --version  # Check if Terraform runs

echo "Installing Node.js dependencies"
npm install
