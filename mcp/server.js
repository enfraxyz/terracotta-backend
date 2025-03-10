const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { TOOLS, executeTools } = require('./tools');

const app = express();
app.use(cors());
app.use(express.json());

// API Documentation in a structured format
const API_SPEC = {
  base_url: process.env.API_BASE_URL || 'http://localhost:3001',
  endpoints: {
    users: {
      signup: {
        path: '/v1/users/signup',
        method: 'POST',
        requires_auth: false,
        params: {
          body: {
            firstName: { type: 'string', required: true },
            lastName: { type: 'string', required: true },
            email: { type: 'string', required: true },
            password: { 
              type: 'string', 
              required: true,
              constraints: [
                'length: 8-34 characters',
                'must contain uppercase letter',
                'must contain lowercase letter',
                'must contain number',
                'must contain special character'
              ]
            }
          }
        },
        response: 'User object'
      },
      login: {
        path: '/v1/users/login',
        method: 'POST',
        requires_auth: false,
        params: {
          body: {
            email: { type: 'string', required: true },
            password: { type: 'string', required: true }
          }
        },
        response: 'User object'
      },
      githubConnect: {
        path: '/v1/users/github',
        method: 'POST',
        requires_auth: true,
        params: {
          body: {
            code: { type: 'string', required: true, description: 'GitHub OAuth code' }
          }
        },
        response: 'Updated user object with GitHub access token'
      },
      githubOrgs: {
        path: '/v1/users/github/orgs',
        method: 'GET',
        requires_auth: true,
        response: 'Array of GitHub organizations'
      },
      githubRepos: {
        path: '/v1/users/github/repos',
        method: 'GET',
        requires_auth: true,
        response: 'Array of GitHub repositories'
      }
    },
    github: {
      webhook: {
        path: '/v1/github/webhook',
        method: 'POST',
        requires_auth: false,
        params: {
          headers: {
            'x-github-event': { type: 'string', required: true },
            'x-hub-signature-256': { type: 'string', required: true }
          },
          body: {
            type: 'GitHub webhook payload',
            description: 'Handles pull request events (opened/reopened)'
          }
        },
        response: 'Webhook received confirmation'
      }
    },
    system: {
      health: {
        path: '/v1/health',
        method: 'GET',
        requires_auth: false,
        response: '200 OK status'
      },
      root: {
        path: '/',
        method: 'GET',
        requires_auth: false,
        response: 'Hello, Terracotta!'
      }
    }
  },
  authentication: {
    type: 'session-based',
    cookie_name: process.env.COOKIE_NAME,
    session_duration: '24 hours'
  }
};

// MCP endpoints
app.get('/context', (req, res) => {
  res.json(API_SPEC);
});

app.get('/endpoints', (req, res) => {
  const endpoints = {};
  Object.keys(API_SPEC.endpoints).forEach(category => {
    Object.keys(API_SPEC.endpoints[category]).forEach(endpoint => {
      const spec = API_SPEC.endpoints[category][endpoint];
      endpoints[`${spec.method} ${spec.path}`] = spec;
    });
  });
  res.json(endpoints);
});

app.get('/auth-requirements', (req, res) => {
  const authEndpoints = {};
  Object.keys(API_SPEC.endpoints).forEach(category => {
    Object.keys(API_SPEC.endpoints[category]).forEach(endpoint => {
      const spec = API_SPEC.endpoints[category][endpoint];
      if (spec.requires_auth) {
        authEndpoints[`${spec.method} ${spec.path}`] = true;
      }
    });
  });
  res.json({
    auth_type: API_SPEC.authentication.type,
    protected_endpoints: authEndpoints
  });
});

// Tool-related endpoints
app.get('/tools', (req, res) => {
  res.json({
    schema_version: "v1",
    tools: TOOLS
  });
});

// SSE endpoint for tool execution
app.get('/execute-stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Handle client disconnect
  req.on('close', () => {
    res.end();
  });

  // Keep the connection alive
  const keepAlive = setInterval(() => {
    res.write(':\n\n');
  }, 30000);

  // Store the response object for tool execution
  req.app.locals.sseRes = res;

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(keepAlive);
    delete req.app.locals.sseRes;
  });
});

app.post('/execute/:tool', async (req, res) => {
  const { tool } = req.params;
  const params = req.body;
  const sessionCookie = req.headers.cookie;
  const sseRes = req.app.locals.sseRes;

  if (!executeTools[tool]) {
    if (sseRes) {
      sseRes.write(`data: ${JSON.stringify({ error: 'Tool not found' })}\n\n`);
    }
    return res.status(404).json({ error: 'Tool not found' });
  }

  try {
    const result = await executeTools[tool](params, sessionCookie);
    if (sseRes) {
      sseRes.write(`data: ${JSON.stringify(result)}\n\n`);
    }
    res.json(result);
  } catch (error) {
    if (sseRes) {
      sseRes.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    }
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.MCP_PORT || 3002;
app.listen(PORT, () => {
  console.log(`MCP Server running on port ${PORT}`);
});
