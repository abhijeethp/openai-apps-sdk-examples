# File Upload MCP server (Node)

This directory contains a minimal Model Context Protocol (MCP) server implemented with the official TypeScript SDK. The server exposes a single widget tool that accepts a file and displays it in the widget UI.

## Prerequisites

- Node.js 18+
- pnpm, npm, or yarn for dependency management

## Install dependencies

```bash
pnpm install
```

If you prefer npm or yarn, adjust the command accordingly.

## Build widget assets

From the repo root:

```bash
pnpm run build
```

This generates `assets/file-viewer.html`, which the MCP server serves to ChatGPT.

## Run the MCP server

```bash
pnpm start
```

The server uses SSE (Server-Sent Events) so it works with the MCP inspector and ChatGPT connectors.

## Test in ChatGPT (quick)

1. Connect this MCP server in developer mode.
2. Invoke the tool named `file-viewer`.
3. Attach an image file when calling the tool (PNG, JPEG, or WebP).
4. The widget shows the uploaded image.

## Test in the widget (upload button)

The widget also supports uploads directly in the UI via `window.openai.uploadFile`.

1. Open the widget.
2. Use the file input to upload a PNG/JPEG/WebP.
3. The widget fetches a temporary download URL and displays the image.

## Tool behavior

- `inputSchema` expects `uploadedFile` with `{ download_url, file_id }`.
- `_meta.openai/fileParams` is set so the platform passes user files to the tool.
- The tool response mirrors the file into `structuredContent.uploadedFile`.
- The widget uses `window.openai.getFileDownloadUrl({ fileId })` to display the image.

This app is intentionally tiny so you can debug file uploads across surfaces.
