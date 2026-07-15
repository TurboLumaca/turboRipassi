/**
 * Tests for the Google Drive REST client (driveRepo).
 * `fetch`, the file system, and the token manager are mocked so the tests
 * exercise only the client's own logic: folder search-or-create, the
 * two-step upload with rollback, and idempotent delete.
 */
import { DriveNotAuthorizedError } from "../driveTypes";

// --- Mocks ------------------------------------------------------------------
const mockGetValidAccessToken = jest.fn<Promise<string | null>, []>();
jest.mock("@/config/driveAuth", () => ({
  driveTokenManager: {
    getValidAccessToken: () => mockGetValidAccessToken(),
  },
}));

const mockUploadAsync = jest.fn();
const mockDownloadAsync = jest.fn();
jest.mock("expo-file-system/legacy", () => ({
  uploadAsync: (...args: unknown[]) => mockUploadAsync(...args),
  downloadAsync: (...args: unknown[]) => mockDownloadAsync(...args),
  FileSystemUploadType: { BINARY_CONTENT: "binary" },
}));

// Imported after the mocks so the module picks them up.
import { driveClient, resetDriveFolderCache } from "../driveRepo";

/** Builds a minimal fake Response for global.fetch. */
function fakeResponse(opts: {
  ok?: boolean;
  status?: number;
  json?: unknown;
  text?: string;
}): Response {
  return {
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    statusText: "",
    json: async () => opts.json,
    text: async () => opts.text ?? "",
  } as unknown as Response;
}

beforeEach(() => {
  jest.clearAllMocks();
  resetDriveFolderCache();
  mockGetValidAccessToken.mockResolvedValue("token-123");
  global.fetch = jest.fn() as unknown as typeof fetch;
});

describe("authorization guard", () => {
  it("throws DriveNotAuthorizedError when there is no valid token", async () => {
    mockGetValidAccessToken.mockResolvedValue(null);
    await expect(driveClient.ensureAppFolder()).rejects.toBeInstanceOf(
      DriveNotAuthorizedError
    );
  });
});

describe("ensureAppFolder", () => {
  it("returns the existing folder id when one is found", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      fakeResponse({ json: { files: [{ id: "folder-abc" }] } })
    );

    const id = await driveClient.ensureAppFolder();

    expect(id).toBe("folder-abc");
    // Only the search call; no creation POST.
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("creates the folder when none exists", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(fakeResponse({ json: { files: [] } })) // search
      .mockResolvedValueOnce(fakeResponse({ json: { id: "new-folder" } })); // create

    const id = await driveClient.ensureAppFolder();

    expect(id).toBe("new-folder");
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const createCall = (global.fetch as jest.Mock).mock.calls[1];
    expect(createCall[1].method).toBe("POST");
  });

  it("caches the folder id across calls (no second lookup)", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      fakeResponse({ json: { files: [{ id: "folder-abc" }] } })
    );

    await driveClient.ensureAppFolder();
    await driveClient.ensureAppFolder();

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("passes the bearer token in the Authorization header", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      fakeResponse({ json: { files: [{ id: "folder-abc" }] } })
    );

    await driveClient.ensureAppFolder();

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer token-123");
  });

  it("throws with the status code when the API responds with an error", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      fakeResponse({ ok: false, status: 500, text: "boom" })
    );

    await expect(driveClient.ensureAppFolder()).rejects.toThrow("Drive API 500");
  });
});

describe("uploadFile", () => {
  /** Primes the folder cache so uploadFile skips the folder lookup. */
  async function primeFolder() {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      fakeResponse({ json: { files: [{ id: "folder-abc" }] } })
    );
    await driveClient.ensureAppFolder();
    (global.fetch as jest.Mock).mockClear();
  }

  it("performs metadata creation then binary upload and returns the ref", async () => {
    await primeFolder();
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      fakeResponse({ json: { id: "file-1", name: "doc.pdf" } })
    );
    mockUploadAsync.mockResolvedValueOnce({ status: 200, body: "" });

    const ref = await driveClient.uploadFile({
      localUri: "file:///tmp/doc.pdf",
      name: "doc.pdf",
      mimeType: "application/pdf",
    });

    expect(ref).toEqual({ id: "file-1", name: "doc.pdf", mimeType: "application/pdf" });
    // Metadata POST includes the parent folder.
    const metaBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(metaBody.parents).toEqual(["folder-abc"]);
    // Binary upload targeted the created file id.
    expect(mockUploadAsync).toHaveBeenCalledTimes(1);
    expect(mockUploadAsync.mock.calls[0][0]).toContain("/files/file-1?uploadType=media");
  });

  it("rolls back (deletes the empty file) when the binary upload fails", async () => {
    await primeFolder();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(fakeResponse({ json: { id: "file-1", name: "doc.pdf" } })) // meta
      .mockResolvedValueOnce(fakeResponse({ ok: true, status: 204 })); // rollback DELETE
    mockUploadAsync.mockResolvedValueOnce({ status: 403, body: "denied" });

    await expect(
      driveClient.uploadFile({
        localUri: "file:///tmp/doc.pdf",
        name: "doc.pdf",
        mimeType: "application/pdf",
      })
    ).rejects.toThrow("Drive upload 403");

    // Second fetch call is the rollback DELETE on the orphaned file.
    const deleteCall = (global.fetch as jest.Mock).mock.calls[1];
    expect(deleteCall[0]).toContain("/files/file-1");
    expect(deleteCall[1].method).toBe("DELETE");
  });

  it("defaults the mime type to application/octet-stream when null", async () => {
    await primeFolder();
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      fakeResponse({ json: { id: "file-2", name: "blob" } })
    );
    mockUploadAsync.mockResolvedValueOnce({ status: 200, body: "" });

    const ref = await driveClient.uploadFile({
      localUri: "file:///tmp/blob",
      name: "blob",
      mimeType: null,
    });

    expect(ref.mimeType).toBe("application/octet-stream");
  });
});

describe("downloadFile", () => {
  it("downloads to the destination and returns the local uri", async () => {
    mockDownloadAsync.mockResolvedValueOnce({ uri: "file:///cache/out.pdf" });

    const uri = await driveClient.downloadFile("file-9", "file:///cache/out.pdf");

    expect(uri).toBe("file:///cache/out.pdf");
    expect(mockDownloadAsync.mock.calls[0][0]).toContain("/files/file-9?alt=media");
    expect(mockDownloadAsync.mock.calls[0][2].headers.Authorization).toBe("Bearer token-123");
  });
});

describe("deleteFile", () => {
  it("treats a 404 as success (idempotent)", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      fakeResponse({ ok: false, status: 404 })
    );
    await expect(driveClient.deleteFile("gone")).resolves.toBeUndefined();
  });

  it("throws on a non-404 error status", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      fakeResponse({ ok: false, status: 500, text: "server error" })
    );
    await expect(driveClient.deleteFile("x")).rejects.toThrow("Drive delete 500");
  });

  it("succeeds on a normal 204 response", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      fakeResponse({ ok: true, status: 204 })
    );
    await expect(driveClient.deleteFile("x")).resolves.toBeUndefined();
  });
});
