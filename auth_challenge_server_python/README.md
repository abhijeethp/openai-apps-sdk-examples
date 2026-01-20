# Auth challenge MCP server (Python)

This sample demonstrates the **HTTP 401 + `WWW-Authenticate`** discovery path for Apps SDK OAuth.
Instead of returning an MCP `mcp/www_authenticate` hint, the server responds to unauthenticated
requests with a `401` and a `WWW-Authenticate` header that includes a
`resource_metadata` URL.

The UI is intentionally minimal. The only tool (`auth_ping`) just returns a short confirmation
message once the request includes a bearer token.

## Configure the protected resource metadata URL

Set the URL of your hosted protected resource metadata document:

```env
PROTECTED_RESOURCE_METADATA_URL=https://example.com/.well-known/oauth-protected-resource
```

If unset, the server uses the placeholder above.

## Run the server

```bash
cd auth_challenge_server_python
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn auth_challenge_server_python.main:app --port 8000
```

## What to expect

- Requests to `/mcp` **without** an `Authorization: Bearer ...` header return:
  - HTTP `401`
  - `WWW-Authenticate: Bearer ... resource_metadata="<your-url>"`
- Requests **with** a bearer token proceed normally and can call `auth_ping`.

This is useful for validating the Apps SDK path that triggers OAuth discovery from a
401 + `WWW-Authenticate` response.
