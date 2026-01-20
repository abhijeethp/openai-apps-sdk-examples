"""MCP server that demonstrates HTTP 401 + WWW-Authenticate auth discovery."""

from __future__ import annotations

import os
from typing import Any, Dict, List

import mcp.types as types
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from dotenv import load_dotenv
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, PlainTextResponse, Response

ROOT_DIR = os.path.dirname(__file__)
load_dotenv(os.path.join(ROOT_DIR, ".env"))

PROTECTED_RESOURCE_METADATA_URL = "https://3f5b218812ec.ngrok-free.app/v1/client/oai/tenant/walmart-us/.well-known/oauth-protected-resource"

TENANT_PROTECTED_RESOURCE_METADATA_PATH = (
    "/v1/client/oai/tenant/walmart-us/.well-known/oauth-protected-resource"
)

PING_TOOL_NAME = "auth_ping"
PING_TOOL_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "title": "Auth ping",
    "properties": {},
    "required": [],
    "additionalProperties": False,
}


def _split_env_list(value: str | None) -> List[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def _transport_security_settings() -> TransportSecuritySettings:
    allowed_hosts = _split_env_list(os.getenv("MCP_ALLOWED_HOSTS"))
    allowed_origins = _split_env_list(os.getenv("MCP_ALLOWED_ORIGINS"))
    if not allowed_hosts and not allowed_origins:
        return TransportSecuritySettings(enable_dns_rebinding_protection=False)
    return TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=allowed_hosts,
        allowed_origins=allowed_origins,
    )


def _build_www_authenticate_header() -> str:
    error = "invalid_token"
    description = "Missing bearer token"
    safe_error = error.replace('"', r"\"")
    safe_description = description.replace('"', r"\"")
    safe_metadata = PROTECTED_RESOURCE_METADATA_URL.replace('"', r"\"")
    return (
        "Bearer "
        f'error="{safe_error}", '
        f'error_description="{safe_description}", '
        f'resource_metadata="{safe_metadata}"'
    )


def _has_bearer_token(request: Request) -> bool:
    header_value = request.headers.get("authorization")
    if not header_value:
        return False
    if not header_value.lower().startswith("bearer "):
        return False
    return bool(header_value[7:].strip())


class WwwAuthenticateMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, header_value: str) -> None:
        super().__init__(app)
        self._header_value = header_value

    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)
        if request.url.path.startswith("/mcp") and not _has_bearer_token(request):
            return PlainTextResponse(
                "Authentication required",
                status_code=401,
                headers={"WWW-Authenticate": self._header_value},
            )
        return await call_next(request)


mcp = FastMCP(
    name="auth-challenge-server-python",
    stateless_http=True,
    transport_security=_transport_security_settings(),
)


@mcp.custom_route(TENANT_PROTECTED_RESOURCE_METADATA_PATH, methods=["GET", "OPTIONS"])
async def tenant_protected_resource_metadata(request: Request) -> Response:
    if request.method == "OPTIONS":
        return Response(status_code=204)
    return JSONResponse(
        {
            "resource": "https://3f5b218812ec.ngrok-free.app/mcp",
            "authorization_servers": ["https://dev-65wmmp5d56ev40iy.us.auth0.com"],
            "scopes_supported": ["orders:read", "orders:write"],
            "bearer_methods_supported": ["header"],
        }
    )


@mcp._mcp_server.list_tools()
async def _list_tools() -> List[types.Tool]:
    return [
        types.Tool(
            name=PING_TOOL_NAME,
            title="Auth ping",
            description="Returns a confirmation message once authenticated.",
            inputSchema=PING_TOOL_SCHEMA,
            annotations={
                "destructiveHint": False,
                "openWorldHint": False,
                "readOnlyHint": True,
            },
        )
    ]


async def _call_tool_request(req: types.CallToolRequest) -> types.ServerResult:
    if req.params.name != PING_TOOL_NAME:
        return types.ServerResult(
            types.CallToolResult(
                content=[types.TextContent(type="text", text="Unknown tool")],
                isError=True,
            )
        )

    return types.ServerResult(
        types.CallToolResult(
            content=[
                types.TextContent(
                    type="text",
                    text="Authenticated call succeeded.",
                )
            ],
        )
    )


mcp._mcp_server.request_handlers[types.CallToolRequest] = _call_tool_request


app = mcp.streamable_http_app()
app.add_middleware(
    WwwAuthenticateMiddleware, header_value=_build_www_authenticate_header()
)

try:
    from starlette.middleware.cors import CORSMiddleware

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
        allow_credentials=False,
    )
except Exception:
    pass


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000)
