import { resolve, relative, basename } from "node:path";
import { lstat, realpath, readFile } from "node:fs/promises";
import { imageSize } from "image-size";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { TgcClient } from "../client/tgc-client.js";
import { TgcError } from "../types/errors.js";

const ALLOWED_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff", ".tif", ".svg", ".webp", ".pdf",
]);

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

const RASTER_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff", ".tif", ".webp",
]);

const MIN_DIMENSION = 50;    // pixels
const MAX_DIMENSION = 10000; // pixels

export function getAllowedBaseDir(): string {
  return process.env.TGC_UPLOAD_BASE_DIR ?? process.cwd();
}

export async function validateFilePath(filePath: string): Promise<string> {
  const baseDir = getAllowedBaseDir();
  const resolved = resolve(filePath);

  const rel = relative(baseDir, resolved);
  if (rel.startsWith("..") || resolve(baseDir, rel) !== resolved) {
    throw new TgcError(
      `File path "${filePath}" is outside the allowed directory.`,
      "validation",
    );
  }

  const segments = rel.split(/[\\/]/);
  for (const segment of segments) {
    if (segment.startsWith(".")) {
      throw new TgcError(
        `File path "${filePath}" contains a hidden file or directory and is not allowed.`,
        "validation",
      );
    }
  }

  const dot = resolved.lastIndexOf(".");
  const ext = dot === -1 ? "" : resolved.slice(dot).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new TgcError(
      `File extension "${ext || "(none)"}" is not allowed. Allowed types: ${[...ALLOWED_EXTENSIONS].join(", ")}`,
      "validation",
    );
  }

  const stats = await lstat(resolved);
  if (stats.size > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (stats.size / (1024 * 1024)).toFixed(1);
    throw new TgcError(
      `File is too large (${sizeMb} MB). Maximum allowed size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`,
      "validation",
    );
  }
  if (stats.isSymbolicLink()) {
    const real = await realpath(resolved);
    const realRel = relative(baseDir, real);
    if (realRel.startsWith("..") || resolve(baseDir, realRel) !== real) {
      throw new TgcError(
        `Symlink "${filePath}" resolves outside the allowed directory.`,
        "validation",
      );
    }
  }

  return resolved;
}

export function validateUploadUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new TgcError(`Invalid URL: "${rawUrl}"`, "validation");
  }

  if (parsed.protocol !== "https:") {
    throw new TgcError(
      `Only https:// URLs are allowed. Got "${parsed.protocol}"`,
      "validation",
    );
  }

  const hostname = parsed.hostname.toLowerCase();

  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".local") ||
    hostname === "0.0.0.0"
  ) {
    throw new TgcError(
      `URL hostname "${hostname}" is not allowed (loopback/local address).`,
      "validation",
    );
  }

  if (hostname === "169.254.169.254" || hostname === "metadata.google.internal") {
    throw new TgcError(
      `URL hostname "${hostname}" is not allowed (cloud metadata endpoint).`,
      "validation",
    );
  }

  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const a = Number(ipv4Match[1]);
    const b = Number(ipv4Match[2]);
    if (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      a === 0
    ) {
      throw new TgcError(
        `URL points to a private/reserved IP address "${hostname}".`,
        "validation",
      );
    }
  }

  if (hostname.startsWith("[") || hostname.includes(":")) {
    throw new TgcError(
      `IPv6 addresses are not allowed in upload URLs.`,
      "validation",
    );
  }

  return parsed;
}

export function validateImageDimensions(
  buffer: Buffer,
  filename: string,
): void {
  const dot = filename.lastIndexOf(".");
  const ext = dot === -1 ? "" : filename.slice(dot).toLowerCase();
  if (!RASTER_EXTENSIONS.has(ext)) {
    return; // Skip SVG, PDF — not raster images
  }

  let dimensions;
  try {
    dimensions = imageSize(buffer);
  } catch {
    throw new TgcError(
      `Unable to read image dimensions from "${filename}". The file may be corrupted.`,
      "validation",
    );
  }

  if (!dimensions.width || !dimensions.height) {
    throw new TgcError(
      `Unable to determine image dimensions for "${filename}".`,
      "validation",
    );
  }

  const { width, height } = dimensions;

  if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
    throw new TgcError(
      `Image is too small (${width}x${height}px). Minimum dimension is ${MIN_DIMENSION}x${MIN_DIMENSION}px.`,
      "validation",
    );
  }

  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    throw new TgcError(
      `Image is too large (${width}x${height}px). Maximum dimension is ${MAX_DIMENSION}x${MAX_DIMENSION}px.`,
      "validation",
    );
  }
}

export async function downloadFromUrl(url: string): Promise<Buffer> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new TgcError(
      `Failed to download file from URL: ${err instanceof Error ? err.message : String(err)}`,
      "validation",
    );
  }
  if (!response.ok) {
    throw new TgcError(
      `Failed to download file from URL: ${response.status} ${response.statusText}`,
      "validation",
    );
  }
  const contentLength = response.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_FILE_SIZE_BYTES) {
    throw new TgcError(
      `File from URL is too large (${(parseInt(contentLength, 10) / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`,
      "validation",
    );
  }
  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_FILE_SIZE_BYTES) {
    throw new TgcError(
      `Downloaded file is too large (${(arrayBuffer.byteLength / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`,
      "validation",
    );
  }
  return Buffer.from(arrayBuffer);
}

function extractFilenameFromUrl(url: string): string | null {
  const urlPath = new URL(url).pathname;
  const extracted = urlPath.split("/").pop();
  if (!extracted || !extracted.includes(".")) return null;
  return extracted;
}

export function handleUploadFile(client: TgcClient) {
  return async (args: {
    folder_id: string;
    file_path?: string;
    url?: string;
    filename?: string;
  }): Promise<CallToolResult> => {
    if (!args.file_path && !args.url) {
      return {
        content: [
          { type: "text", text: "Either file_path or url must be provided." },
        ],
        isError: true,
      };
    }
    if (args.file_path && args.url) {
      return {
        content: [
          {
            type: "text",
            text: "Provide either file_path or url, not both.",
          },
        ],
        isError: true,
      };
    }

    let buffer: Buffer;
    let filename: string;

    if (args.url) {
      validateUploadUrl(args.url);

      const resolved = args.filename ?? extractFilenameFromUrl(args.url);
      if (!resolved) {
        return {
          content: [
            {
              type: "text",
              text: "Cannot determine filename from URL. Please provide the filename parameter.",
            },
          ],
          isError: true,
        };
      }
      filename = resolved;
      buffer = await downloadFromUrl(args.url);
    } else {
      const validatedPath = await validateFilePath(args.file_path!);
      filename = args.filename ?? basename(validatedPath);
      buffer = Buffer.from(await readFile(validatedPath));
    }

    validateImageDimensions(buffer, filename);

    const file = await client.uploadFileFromBuffer(
      args.folder_id,
      new Uint8Array(buffer) as Uint8Array<ArrayBuffer>,
      filename,
    );

    return {
      content: [
        {
          type: "text",
          text: `File uploaded successfully.\n\n${JSON.stringify(file, null, 2)}`,
        },
      ],
    };
  };
}
