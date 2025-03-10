# Terracotta Backend

Terracotta is a backend service that provides user management and GitHub integration capabilities. It includes a Model Context Protocol (MCP) server that enables AI tools like Cursor to interact with the API programmatically.

## Getting Started

### Prerequisites
- Node.js
- MongoDB
- GitHub OAuth App credentials

### Installation
1. Clone the repository
2. Install dependencies:
```bash
npm install
cd mcp && npm install
```

3. Set up environment variables:
```bash
# Main API
PORT=3001
MONGO_URI=your_mongodb_uri
SESSION_SECRET=your_session_secret
COOKIE_NAME=terracotta.sid
GITHUB_OAUTH_CLIENT_ID=your_github_client_id
GITHUB_OAUTH_CLIENT_SECRET=your_github_client_secret

# MCP Server
MCP_PORT=3002
API_BASE_URL=http://localhost:3001
```

4. Start the servers:
```bash
# Main API
npm start

# MCP Server
cd mcp && npm start
```

## API Endpoints

### System Endpoints
- `GET /` - Basic hello endpoint
- `GET /v1/health` - Health check endpoint

### User Management
- `POST /v1/users/signup` - Create new user account
  ```json
  {
    "firstName": "string",
    "lastName": "string",
    "email": "string",
    "password": "string (8-34 chars, must contain uppercase, lowercase, number, special char)"
  }
  ```

- `POST /v1/users/login` - Login existing user
  ```json
  {
    "email": "string",
    "password": "string"
  }
  ```

### GitHub Integration
- `POST /v1/users/github` - Connect GitHub account (requires authentication)
  ```json
  {
    "code": "string (GitHub OAuth code)"
  }
  ```

- `GET /v1/users/github/orgs` - Get user's GitHub organizations (requires authentication)
- `GET /v1/users/github/repos` - Get user's GitHub repositories (requires authentication)

- `POST /v1/github/webhook` - GitHub webhook endpoint
  ```json
  Headers:
  {
    "x-github-event": "string",
    "x-hub-signature-256": "string"
  }
  Body: GitHub webhook payload
  ```

## Model Context Protocol (MCP) Server

The MCP server enables AI tools (like Cursor) to interact with the Terracotta API programmatically. It provides a standardized way for AI models to discover and use available endpoints.

### MCP Setup
1. Start the MCP server:
```bash
cd mcp && npm start
```

2. Configure Cursor:
   - Open Cursor settings
   - Set MCP URL to: `http://localhost:3002/execute-stream`

### Available MCP Tools
1. `signup_user` - Create new user account
2. `login_user` - Login existing user
3. `connect_github` - Connect GitHub account
4. `get_github_orgs` - Get GitHub organizations
5. `get_github_repos` - Get GitHub repositories
6. `github_webhook` - Handle GitHub webhooks
7. `health_check` - Check API health

### MCP Endpoints
- `GET /tools` - Get available tools and their specifications
- `GET /execute-stream` - SSE endpoint for tool execution
- `POST /execute/:tool` - Execute a specific tool

## Authentication

The API uses session-based authentication with the following characteristics:
- Session duration: 24 hours
- Cookie name: Configured via `COOKIE_NAME` environment variable
- Secure cookies in non-local environments
- MongoDB session store

## Development

### Branch Information
- Current branch: `feature/mcp-server`
- Purpose: Implementation of Model Context Protocol server for AI tool integration

### Security Notes
- All passwords must meet complexity requirements
- GitHub webhooks should be configured with proper secret
- Session cookies are secure in production environments
- API keys and secrets should never be committed to the repository 