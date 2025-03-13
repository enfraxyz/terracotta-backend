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

echo "Updating PATH in .bashrc and .profile"
echo 'export PATH="$HOME/bin:$PATH"' >> $HOME/.bashrc
echo 'export PATH="$HOME/bin:$PATH"' >> $HOME/.profile

echo "Verifying Terraform installation"
$HOME/bin/terraform --version

echo "Installing Node.js dependencies"
npm install
