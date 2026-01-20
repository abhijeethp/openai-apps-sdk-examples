import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from "react";
import { createRoot } from "react-dom/client";
import { useOpenAiGlobal } from "../use-openai-global";
import { useWidgetState } from "../use-widget-state";

type FileRef = {
  download_url?: string;
  file_id?: string;
};

type ToolOutput = {
  uploadedFile?: FileRef;
};

type StructuredWidgetState = {
  modelContent: string;
  privateContent: {
    fileId?: string;
    downloadUrl?: string;
    source?: "upload" | "tool";
  };
  imageIds?: string[];
};

type UploadResponse = {
  fileId?: string;
};

type DownloadResponse = {
  downloadUrl?: string;
};

function App() {
  const toolOutput = useOpenAiGlobal("toolOutput") as ToolOutput | null;
  const maxHeight = useOpenAiGlobal("maxHeight");
  const safeArea = useOpenAiGlobal("safeArea");
  const [widgetState, setWidgetState] = useWidgetState<
    StructuredWidgetState | null
  >(null);

  const [fileId, setFileId] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Waiting for upload...");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasOpenAi = typeof window !== "undefined" && window.openai != null;
  const canUpload = Boolean(window?.openai?.uploadFile);
  const canDownload = Boolean(window?.openai?.getFileDownloadUrl);

  const containerStyle = useMemo(() => {
    const nextStyle: CSSProperties = {};
    if (typeof maxHeight === "number") {
      nextStyle.maxHeight = maxHeight;
      nextStyle.overflowY = "auto";
    }
    const topInset = safeArea?.insets?.top ?? 0;
    const bottomInset = safeArea?.insets?.bottom ?? 0;
    if (topInset > 0) {
      nextStyle.paddingTop = topInset + 12;
    }
    if (bottomInset > 0) {
      nextStyle.paddingBottom = bottomInset + 12;
    }
    return nextStyle;
  }, [maxHeight, safeArea]);

  const displayUrl = useMemo(() => {
    if (downloadUrl && downloadUrl.length > 0) {
      return downloadUrl;
    }
    return null;
  }, [downloadUrl]);

  useEffect(() => {
    if (!widgetState?.privateContent) {
      return;
    }

    const { fileId: storedFileId, downloadUrl: storedDownloadUrl } =
      widgetState.privateContent;

    if (storedFileId && storedFileId !== fileId) {
      setFileId(storedFileId);
    }

    if (storedDownloadUrl && storedDownloadUrl !== downloadUrl) {
      setDownloadUrl(storedDownloadUrl);
    }
  }, [widgetState, fileId, downloadUrl]);

  useEffect(() => {
    const incoming = toolOutput?.uploadedFile;
    if (!incoming) {
      return;
    }

    const nextFileId =
      typeof incoming.file_id === "string" ? incoming.file_id : null;
    const nextDownloadUrl =
      typeof incoming.download_url === "string" ? incoming.download_url : null;

    if (!nextFileId && !nextDownloadUrl) {
      return;
    }

    setStatus("Received file from tool.");
    setErrorMessage(null);

    if (nextFileId) {
      void resolveDownloadUrl(nextFileId, nextDownloadUrl, "tool");
      return;
    }

    if (nextDownloadUrl) {
      setDownloadUrl(nextDownloadUrl);
      persistWidgetState({
        fileId: fileId ?? undefined,
        downloadUrl: nextDownloadUrl,
        source: "tool",
      });
    }
  }, [toolOutput]);

  async function resolveDownloadUrl(
    nextFileId: string,
    fallbackUrl: string | null,
    source: "upload" | "tool"
  ) {
    setFileId(nextFileId);
    if (fallbackUrl) {
      setDownloadUrl(fallbackUrl);
    }

    if (window?.openai?.getFileDownloadUrl) {
      try {
        const response = (await window.openai.getFileDownloadUrl({
          fileId: nextFileId,
        })) as DownloadResponse;
        if (response?.downloadUrl) {
          setDownloadUrl(response.downloadUrl);
          persistWidgetState({
            fileId: nextFileId,
            downloadUrl: response.downloadUrl,
            source,
          });
          return;
        }
      } catch (error) {
        setErrorMessage(`Download URL error: ${String(error)}`);
      }
    }

    persistWidgetState({
      fileId: nextFileId,
      downloadUrl: fallbackUrl ?? undefined,
      source,
    });
  }

  function persistWidgetState(next: {
    fileId?: string;
    downloadUrl?: string;
    source?: "upload" | "tool";
  }) {
    const modelContent = next.fileId
      ? `Displaying file ${next.fileId}`
      : "No file selected";

    setWidgetState({
      modelContent,
      privateContent: {
        fileId: next.fileId,
        downloadUrl: next.downloadUrl,
        source: next.source,
      },
      imageIds: next.fileId ? [next.fileId] : [],
    });
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setErrorMessage(null);
    setStatus("Uploading...");

    if (!window?.openai?.uploadFile) {
      setStatus("Upload API unavailable.");
      setErrorMessage("window.openai.uploadFile is not available.");
      return;
    }

    try {
      const response = (await window.openai.uploadFile(file)) as UploadResponse;
      const nextFileId = response?.fileId;
      if (!nextFileId) {
        setStatus("Upload failed.");
        setErrorMessage("No fileId returned from uploadFile.");
        return;
      }

      setStatus("Uploaded. Fetching download URL...");
      await resolveDownloadUrl(nextFileId, null, "upload");
      setStatus("Ready.");
    } catch (error) {
      setStatus("Upload failed.");
      setErrorMessage(String(error));
    }
  }

  return (
    <div
      className="flex min-h-[320px] w-full items-center justify-center bg-gradient-to-br from-[#0b1f2e] via-[#1d2847] to-[#33234a] p-6 text-white"
      style={containerStyle}
    >
      <div className="w-full max-w-2xl rounded-3xl border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur">
        <header className="mb-6">
          <p className="text-xs uppercase tracking-[0.35em] text-white/60">
            File upload demo
          </p>
          <h1 className="mt-2 text-2xl font-semibold">
            Upload an image and preview it
          </h1>
          <p className="mt-2 text-sm text-white/70">
            Uses `window.openai.uploadFile` + `getFileDownloadUrl`. Also accepts
            files sent into the tool.
          </p>
          {!hasOpenAi ? (
            <p className="mt-3 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs text-white/70">
              Waiting for the host to inject window.openai...
            </p>
          ) : null}
        </header>

        <section className="mb-5 rounded-2xl border border-white/10 bg-white/5 p-4">
          <label className="mb-3 block text-xs font-semibold uppercase tracking-[0.25em] text-white/70">
            Upload image (png / jpeg / webp)
          </label>
          <input
            className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white file:mr-4 file:rounded-lg file:border-0 file:bg-white/20 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white/80"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
          />
          <div className="mt-3 text-xs text-white/60">
            Upload available: {canUpload ? "yes" : "no"} · Download available:{" "}
            {canDownload ? "yes" : "no"}
          </div>
        </section>

        <section className="mb-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-white/60">
              Status
            </p>
            <p className="mt-2 text-sm text-white">{status}</p>
            {errorMessage ? (
              <p className="mt-2 text-xs text-[#ffb4b4]">{errorMessage}</p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-white/60">
              File info
            </p>
            <p className="mt-2 text-xs text-white/80">File ID: {fileId ?? "-"}</p>
            <p className="mt-1 text-xs text-white/60">
              Download URL: {displayUrl ? "ready" : "-"}
            </p>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/15 bg-black/40">
          <div className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
            Preview
          </div>
          <div className="flex min-h-[220px] items-center justify-center p-4">
            {displayUrl ? (
              <img
                src={displayUrl}
                alt="Uploaded"
                className="max-h-64 w-auto rounded-xl border border-white/20 object-contain shadow-lg"
              />
            ) : (
              <div className="text-sm text-white/50">
                Upload an image or call the tool with a file to preview it here.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

const root = document.getElementById("file-viewer-root");
if (!root) {
  throw new Error("Missing #file-viewer-root element");
}

createRoot(root).render(<App />);
