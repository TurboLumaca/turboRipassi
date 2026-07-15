/**
 * Tests for driveConfig: platform-specific client ID resolution and the
 * isDriveConfigured() guard. The module reads the client ID at import time
 * from env + Constants.extra, so each test resets modules and re-imports
 * with a controlled Platform.OS and environment.
 */

/** Loads driveConfig fresh with a given platform and env overrides. */
function loadConfig(platform: string, env: Record<string, string | undefined>) {
  let mod!: typeof import("../driveConfig");
  jest.isolateModules(() => {
    jest.doMock("react-native", () => ({ Platform: { OS: platform } }));
    jest.doMock("expo-constants", () => ({ default: { expoConfig: { extra: {} } } }));
    for (const [k, v] of Object.entries(env)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    mod = require("../driveConfig");
  });
  return mod;
}

const ALL_KEYS = [
  "EXPO_PUBLIC_GOOGLE_CLIENT_ID",
  "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID",
  "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID",
];

afterEach(() => {
  for (const k of ALL_KEYS) delete process.env[k];
});

describe("GOOGLE_CLIENT_ID resolution", () => {
  it("uses the Android client id on Android", () => {
    const cfg = loadConfig("android", {
      EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: "android-id",
      EXPO_PUBLIC_GOOGLE_CLIENT_ID: "generic-id",
    });
    expect(cfg.GOOGLE_CLIENT_ID).toBe("android-id");
  });

  it("uses the iOS client id on iOS", () => {
    const cfg = loadConfig("ios", {
      EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: "ios-id",
      EXPO_PUBLIC_GOOGLE_CLIENT_ID: "generic-id",
    });
    expect(cfg.GOOGLE_CLIENT_ID).toBe("ios-id");
  });

  it("falls back to the generic client id when the platform one is missing", () => {
    const cfg = loadConfig("ios", {
      EXPO_PUBLIC_GOOGLE_CLIENT_ID: "generic-id",
    });
    expect(cfg.GOOGLE_CLIENT_ID).toBe("generic-id");
  });
});

describe("isDriveConfigured", () => {
  it("is true when a real client id is set", () => {
    const cfg = loadConfig("android", {
      EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: "479855671411-real.apps.googleusercontent.com",
    });
    expect(cfg.isDriveConfigured()).toBe(true);
  });

  it("is false when no client id is set at all", () => {
    const cfg = loadConfig("android", {});
    expect(cfg.isDriveConfigured()).toBe(false);
  });

  it("is false when the value is still a PLACEHOLDER", () => {
    const cfg = loadConfig("android", {
      EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: "GOOGLE_ANDROID_CLIENT_ID_PLACEHOLDER",
    });
    expect(cfg.isDriveConfigured()).toBe(false);
  });
});

describe("constants", () => {
  it("requests only the least-privilege drive.file scope", () => {
    const cfg = loadConfig("android", {});
    expect(cfg.DRIVE_SCOPES).toEqual(["https://www.googleapis.com/auth/drive.file"]);
  });

  it("targets the dedicated app folder", () => {
    const cfg = loadConfig("android", {});
    expect(cfg.DRIVE_APP_FOLDER).toBe("ripassiProgrammati");
  });
});
