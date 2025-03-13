# Build stage
FROM node:20-bullseye AS builder

# Set working directory
WORKDIR /

# Install required system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Define Terraform version
ENV TERRAFORM_VERSION=1.11.2
ENV TERRAFORM_ARCH=amd64 

# Download and install Terraform CLI
RUN curl -fsSL -o terraform.zip "https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_${TERRAFORM_ARCH}.zip" \
    && unzip terraform.zip \
    && mv terraform /usr/local/bin/ \
    && chmod +x /usr/local/bin/terraform \
    && rm terraform.zip

# Verify Terraform installation
RUN terraform --version

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Production stage
FROM node:20-bullseye AS production

# Set working directory
WORKDIR /

# Install required system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Copy built application and installed dependencies from builder
COPY --from=builder / /app

# Copy Terraform from builder stage
COPY --from=builder /usr/local/bin/terraform /usr/local/bin/terraform

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Expose application port
EXPOSE 3001

# Start server
CMD ["npm", "start"]
