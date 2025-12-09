# Authenticated MCP server (Python)

This example shows how to build an authenticated app with the OpenAI Apps SDK.
It demonstrates triggering the ChatGPT authentication UI by responding with MCP
authorization metadata and follows the same OAuth flow described in the MCP
authorization spec: https://modelcontextprotocol.io/docs/tutorials/security/authorization#the-authorization-flow:-step-by-step.
The Apps SDK auth guide covers how the UI is triggered: https://developers.openai.com/apps-sdk/build/auth#triggering-authentication-ui.

The server exposes a single pizza-carousel tool that requires a bearer token.
If a request is missing a token, the server returns an `mcp/www_authenticate`
hint (backed by `WWW-Authenticate`) plus `/.well-known/oauth-protected-resource`
metadata so ChatGPT knows which authorization server to use. With a valid token,
the tool returns the pizza carousel widget markup.

## Prerequisites

- Python 3.10+
- A virtual environment (recommended)

## Installation

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Running the server

```bash
python main.py
```

The server listens on `http://127.0.0.1:8000` and exposes the standard MCP
endpoints:

- `GET /mcp` for the SSE stream
- `POST /mcp/messages?sessionId=...` for follow-ups

The pizza carousel tool echoes the optional `searchTerm` argument as a topping
and returns structured content plus widget markup. Unauthenticated calls return
the MCP auth hint so the Apps SDK can start the OAuth flow.

## Customization

- Update `AUTHORIZATION_SERVER_URL` (and the resource URL in `main.py`) to point
  to your OAuth provider.
- Adjust the `WWW-Authenticate` construction or scopes to match your security
  model.
- Rebuild the widget assets (`pnpm run build`) if you change the UI.
