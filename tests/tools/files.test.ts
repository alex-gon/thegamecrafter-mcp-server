import { vi } from "vitest";
import { resolve, join } from "node:path";
import { TgcError } from "../../src/types/errors.js";
import { createMockClient, mockFile } from "../helpers/mocks.js";

// Mock node:fs/promises before imports
vi.mock("node:fs/promises", () => ({
  lstat: vi.fn(),
  realpath: vi.fn(),
  readFile: vi.fn(),
}));

// Mock image-size — we'll restore the real impl for validateImageDimensions tests
const { imageSize: realImageSize } = await vi.hoisted(
  () => import("image-size"),
);
vi.mock("image-size", () => ({
  imageSize: vi.fn().mockReturnValue({ width: 500, height: 500, type: "png" }),
}));

import { lstat, realpath, readFile } from "node:fs/promises";
import { imageSize } from "image-size";
import {
  validateFilePath,
  validateUploadUrl,
  validateImageDimensions,
  downloadFromUrl,
  handleUploadFile,
} from "../../src/tools/files.js";

const FAKE_CWD = "/fake/project";

function mockLstatRegularFile() {
  (lstat as ReturnType<typeof vi.fn>).mockResolvedValue({
    isSymbolicLink: () => false,
  });
}

function mockLstatSymlink() {
  (lstat as ReturnType<typeof vi.fn>).mockResolvedValue({
    isSymbolicLink: () => true,
  });
}

// Minimal valid PNG buffer for a given width/height.
// image-size only reads the IHDR chunk, so CRC can be zeroed.
function createMinimalPng(width: number, height: number): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk: 13 bytes of data
  const ihdrLength = Buffer.alloc(4);
  ihdrLength.writeUInt32BE(13, 0);
  const ihdrType = Buffer.from("IHDR");
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 2;  // color type (RGB)
  const ihdrCrc = Buffer.alloc(4); // zeroed CRC — image-size doesn't verify it

  // IEND chunk
  const iendLength = Buffer.alloc(4, 0);
  const iendType = Buffer.from("IEND");
  const iendCrc = Buffer.alloc(4);

  return Buffer.concat([
    signature,
    ihdrLength, ihdrType, ihdrData, ihdrCrc,
    iendLength, iendType, iendCrc,
  ]);
}

describe("validateFilePath", () => {
  beforeEach(() => {
    vi.spyOn(process, "cwd").mockReturnValue(FAKE_CWD);
    delete process.env.TGC_UPLOAD_BASE_DIR;
    mockLstatRegularFile();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts valid PNG in cwd", async () => {
    const result = await validateFilePath(join(FAKE_CWD, "card.png"));
    expect(result).toBe(resolve(FAKE_CWD, "card.png"));
  });

  it("accepts valid JPG in subdirectory", async () => {
    const result = await validateFilePath(join(FAKE_CWD, "images/card.jpg"));
    expect(result).toBe(resolve(FAKE_CWD, "images/card.jpg"));
  });

  it("accepts valid PDF file", async () => {
    const result = await validateFilePath(join(FAKE_CWD, "rules.pdf"));
    expect(result).toBe(resolve(FAKE_CWD, "rules.pdf"));
  });

  it("accepts .tif extension", async () => {
    const result = await validateFilePath(join(FAKE_CWD, "image.tif"));
    expect(result).toBe(resolve(FAKE_CWD, "image.tif"));
  });

  it("rejects path traversal with ../../etc/passwd", async () => {
    await expect(
      validateFilePath(join(FAKE_CWD, "../../etc/passwd")),
    ).rejects.toThrow(TgcError);
  });

  it("rejects absolute path outside cwd", async () => {
    await expect(validateFilePath("/etc/passwd")).rejects.toThrow(TgcError);
    try {
      await validateFilePath("/etc/passwd");
    } catch (e) {
      expect((e as TgcError).category).toBe("validation");
      expect((e as TgcError).message).toContain("outside");
    }
  });

  it("rejects traversal that resolves outside base", async () => {
    await expect(
      validateFilePath(join(FAKE_CWD, "foo/../../bar.png")),
    ).rejects.toThrow(TgcError);
  });

  it("rejects hidden file .env", async () => {
    await expect(
      validateFilePath(join(FAKE_CWD, ".env")),
    ).rejects.toThrow(TgcError);
    try {
      await validateFilePath(join(FAKE_CWD, ".env"));
    } catch (e) {
      expect((e as TgcError).message).toContain("hidden");
    }
  });

  it("rejects hidden directory segment", async () => {
    await expect(
      validateFilePath(join(FAKE_CWD, "foo/.hidden/bar.png")),
    ).rejects.toThrow(TgcError);
  });

  it("rejects .ssh/id_rsa", async () => {
    await expect(
      validateFilePath(join(FAKE_CWD, ".ssh/id_rsa")),
    ).rejects.toThrow(TgcError);
  });

  it("rejects .exe extension", async () => {
    await expect(
      validateFilePath(join(FAKE_CWD, "malware.exe")),
    ).rejects.toThrow(TgcError);
    try {
      await validateFilePath(join(FAKE_CWD, "malware.exe"));
    } catch (e) {
      expect((e as TgcError).message).toContain("not allowed");
    }
  });

  it("rejects .sh extension", async () => {
    await expect(
      validateFilePath(join(FAKE_CWD, "script.sh")),
    ).rejects.toThrow(TgcError);
  });

  it("rejects file with no extension", async () => {
    await expect(
      validateFilePath(join(FAKE_CWD, "Makefile")),
    ).rejects.toThrow(TgcError);
  });

  it("rejects symlink escaping base dir", async () => {
    mockLstatSymlink();
    (realpath as ReturnType<typeof vi.fn>).mockResolvedValue("/etc/passwd");
    await expect(
      validateFilePath(join(FAKE_CWD, "link.png")),
    ).rejects.toThrow(TgcError);
    try {
      await validateFilePath(join(FAKE_CWD, "link.png"));
    } catch (e) {
      expect((e as TgcError).message).toContain("Symlink");
    }
  });

  it("accepts symlink within base dir", async () => {
    mockLstatSymlink();
    (realpath as ReturnType<typeof vi.fn>).mockResolvedValue(
      resolve(FAKE_CWD, "actual/card.png"),
    );
    const result = await validateFilePath(join(FAKE_CWD, "link.png"));
    expect(result).toBe(resolve(FAKE_CWD, "link.png"));
  });

  it("respects TGC_UPLOAD_BASE_DIR env var", async () => {
    process.env.TGC_UPLOAD_BASE_DIR = "/custom/uploads";
    const result = await validateFilePath("/custom/uploads/card.png");
    expect(result).toBe(resolve("/custom/uploads/card.png"));
  });
});

describe("validateUploadUrl", () => {
  it("accepts valid HTTPS URL", () => {
    const url = validateUploadUrl("https://example.com/image.png");
    expect(url.protocol).toBe("https:");
    expect(url.hostname).toBe("example.com");
  });

  it("rejects HTTP URL", () => {
    expect(() => validateUploadUrl("http://example.com/image.png")).toThrow(
      TgcError,
    );
    try {
      validateUploadUrl("http://example.com/image.png");
    } catch (e) {
      expect((e as TgcError).message).toContain("Only https://");
    }
  });

  it("rejects file:// protocol", () => {
    expect(() => validateUploadUrl("file:///etc/passwd")).toThrow(TgcError);
  });

  it("rejects ftp:// protocol", () => {
    expect(() => validateUploadUrl("ftp://server/file.png")).toThrow(TgcError);
  });

  it("rejects localhost", () => {
    expect(() => validateUploadUrl("https://localhost/img.png")).toThrow(
      TgcError,
    );
    try {
      validateUploadUrl("https://localhost/img.png");
    } catch (e) {
      expect((e as TgcError).message).toContain("loopback");
    }
  });

  it("rejects 127.0.0.1", () => {
    expect(() => validateUploadUrl("https://127.0.0.1/img.png")).toThrow(
      TgcError,
    );
  });

  it("rejects 0.0.0.0", () => {
    expect(() => validateUploadUrl("https://0.0.0.0/img.png")).toThrow(
      TgcError,
    );
  });

  it("rejects .local domains", () => {
    expect(() => validateUploadUrl("https://myhost.local/img.png")).toThrow(
      TgcError,
    );
  });

  it("rejects private 10.x.x.x range", () => {
    expect(() => validateUploadUrl("https://10.0.0.1/img.png")).toThrow(
      TgcError,
    );
  });

  it("rejects private 192.168.x.x range", () => {
    expect(() => validateUploadUrl("https://192.168.1.1/img.png")).toThrow(
      TgcError,
    );
  });

  it("rejects cloud metadata 169.254.169.254", () => {
    expect(() =>
      validateUploadUrl("https://169.254.169.254/latest/meta-data/"),
    ).toThrow(TgcError);
    try {
      validateUploadUrl("https://169.254.169.254/latest/meta-data/");
    } catch (e) {
      expect((e as TgcError).message).toContain("cloud metadata");
    }
  });

  it("rejects metadata.google.internal", () => {
    expect(() =>
      validateUploadUrl("https://metadata.google.internal/computeMetadata/v1/"),
    ).toThrow(TgcError);
  });

  it("rejects invalid URL", () => {
    expect(() => validateUploadUrl("not-a-url")).toThrow(TgcError);
    try {
      validateUploadUrl("not-a-url");
    } catch (e) {
      expect((e as TgcError).message).toContain("Invalid URL");
    }
  });
});

describe("validateImageDimensions", () => {
  // Use the real imageSize for dimension validation tests
  beforeEach(() => {
    vi.mocked(imageSize).mockImplementation(realImageSize);
  });

  afterEach(() => {
    vi.mocked(imageSize).mockReturnValue({ width: 500, height: 500, type: "png" } as ReturnType<typeof imageSize>);
  });

  it("accepts a valid PNG within limits", () => {
    const buf = createMinimalPng(800, 600);
    expect(() => validateImageDimensions(buf, "card.png")).not.toThrow();
  });

  it("accepts image at exact minimum dimensions (50x50)", () => {
    const buf = createMinimalPng(50, 50);
    expect(() => validateImageDimensions(buf, "tiny.png")).not.toThrow();
  });

  it("accepts image at exact maximum dimensions (10000x10000)", () => {
    const buf = createMinimalPng(10000, 10000);
    expect(() => validateImageDimensions(buf, "huge.png")).not.toThrow();
  });

  it("rejects image below minimum dimensions", () => {
    const buf = createMinimalPng(10, 10);
    expect(() => validateImageDimensions(buf, "small.png")).toThrow(TgcError);
    try {
      validateImageDimensions(buf, "small.png");
    } catch (e) {
      expect((e as TgcError).message).toContain("too small");
      expect((e as TgcError).message).toContain("10x10");
    }
  });

  it("rejects image just below minimum (49x49)", () => {
    const buf = createMinimalPng(49, 49);
    expect(() => validateImageDimensions(buf, "almost.png")).toThrow(TgcError);
  });

  it("rejects image above maximum dimensions", () => {
    const buf = createMinimalPng(20000, 15000);
    expect(() => validateImageDimensions(buf, "massive.png")).toThrow(TgcError);
    try {
      validateImageDimensions(buf, "massive.png");
    } catch (e) {
      expect((e as TgcError).message).toContain("too large");
      expect((e as TgcError).message).toContain("20000x15000");
    }
  });

  it("rejects image just above maximum (10001x10001)", () => {
    const buf = createMinimalPng(10001, 10001);
    expect(() => validateImageDimensions(buf, "over.png")).toThrow(TgcError);
  });

  it("rejects when only width is below minimum", () => {
    const buf = createMinimalPng(30, 200);
    expect(() => validateImageDimensions(buf, "narrow.png")).toThrow(TgcError);
  });

  it("rejects when only height exceeds maximum", () => {
    const buf = createMinimalPng(5000, 12000);
    expect(() => validateImageDimensions(buf, "tall.png")).toThrow(TgcError);
  });

  it("skips validation for SVG files", () => {
    const buf = Buffer.from("not a real image");
    expect(() => validateImageDimensions(buf, "icon.svg")).not.toThrow();
  });

  it("skips validation for PDF files", () => {
    const buf = Buffer.from("not a real image");
    expect(() => validateImageDimensions(buf, "rules.pdf")).not.toThrow();
  });

  it("throws for corrupted/unreadable image data", () => {
    const buf = Buffer.from("this is garbage data");
    expect(() => validateImageDimensions(buf, "corrupt.png")).toThrow(TgcError);
    try {
      validateImageDimensions(buf, "corrupt.png");
    } catch (e) {
      expect((e as TgcError).message).toContain("corrupted");
    }
  });
});

describe("handleUploadFile", () => {
  it("returns error when neither file_path nor url provided", async () => {
    const client = createMockClient();
    const handler = handleUploadFile(client);
    const result = await handler({ folder_id: "folder-1" });
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain("Either");
  });

  it("returns error when both file_path and url provided", async () => {
    const client = createMockClient();
    const handler = handleUploadFile(client);
    const result = await handler({
      folder_id: "folder-1",
      file_path: "/some/file.png",
      url: "https://example.com/file.png",
    });
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain("not both");
  });

  it("downloads from URL and uploads via buffer", async () => {
    const client = createMockClient();
    const fakeBuffer = new ArrayBuffer(8);
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      arrayBuffer: vi.fn().mockResolvedValue(fakeBuffer),
    } as unknown as Response);
    (client.uploadFileFromBuffer as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFile(),
    );
    const handler = handleUploadFile(client);
    const result = await handler({
      folder_id: "folder-1",
      url: "https://example.com/image.png",
      filename: "test.png",
    });
    expect(result.isError).toBeUndefined();
    expect(client.uploadFileFromBuffer).toHaveBeenCalledWith(
      "folder-1",
      expect.any(Uint8Array),
      "test.png",
    );
    vi.restoreAllMocks();
  });

  it("extracts filename from URL path when not provided", async () => {
    const client = createMockClient();
    const fakeBuffer = new ArrayBuffer(8);
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      arrayBuffer: vi.fn().mockResolvedValue(fakeBuffer),
    } as unknown as Response);
    (client.uploadFileFromBuffer as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFile(),
    );
    const handler = handleUploadFile(client);
    await handler({
      folder_id: "folder-1",
      url: "https://example.com/path/to/card.png",
    });
    expect(client.uploadFileFromBuffer).toHaveBeenCalledWith(
      "folder-1",
      expect.any(Uint8Array),
      "card.png",
    );
    vi.restoreAllMocks();
  });

  it("reads local file and uploads via buffer", async () => {
    const cwd = process.cwd();
    process.env.TGC_UPLOAD_BASE_DIR = cwd;
    mockLstatRegularFile();
    const pngBuffer = createMinimalPng(500, 500);
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(pngBuffer);
    const client = createMockClient();
    (client.uploadFileFromBuffer as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFile(),
    );
    const handler = handleUploadFile(client);
    const filePath = join(cwd, "test-card.png");
    const result = await handler({
      folder_id: "folder-1",
      file_path: filePath,
    });
    expect(result.isError).toBeUndefined();
    expect(client.uploadFileFromBuffer).toHaveBeenCalledWith(
      "folder-1",
      expect.any(Uint8Array),
      "test-card.png",
    );
    delete process.env.TGC_UPLOAD_BASE_DIR;
  });
});
