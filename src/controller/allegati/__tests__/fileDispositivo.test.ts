/**
 * Test — where each kind of file goes when it is opened.
 *
 * The case that matters: on iOS the system route for a PDF is the share sheet,
 * which can send the file but not read it, so the PDF is handed back to the
 * View to be shown in-app. Android keeps its VIEW intent.
 */
import { Platform } from "react-native";
import * as Sharing from "expo-sharing";
import * as IntentLauncher from "expo-intent-launcher";
import { apriUriLocale, condividiFile } from "../fileDispositivo";

jest.mock("expo-image-picker", () => ({}));
jest.mock("expo-document-picker", () => ({}));
jest.mock("expo-sharing", () => ({ shareAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock("expo-intent-launcher", () => ({
  startActivityAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("expo-file-system/legacy", () => ({
  getContentUriAsync: jest.fn().mockResolvedValue("content://a.pdf"),
}));

const setOS = (os: "ios" | "android") => {
  Platform.OS = os;
};

beforeEach(() => jest.clearAllMocks());

describe("apriUriLocale", () => {
  it("su iOS restituisce il PDF alla View invece di aprire il foglio di condivisione", async () => {
    setOS("ios");
    await expect(apriUriLocale("file:///a.pdf", "application/pdf")).resolves.toEqual({
      tipo: "pdf",
      uri: "file:///a.pdf",
    });
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });

  it("su Android il PDF va al lettore di sistema", async () => {
    setOS("android");
    await expect(apriUriLocale("file:///a.pdf", "application/pdf")).resolves.toEqual({
      tipo: "esterno",
    });
    expect(IntentLauncher.startActivityAsync).toHaveBeenCalled();
  });

  it("le immagini restano alla View su entrambe le piattaforme", async () => {
    setOS("ios");
    await expect(apriUriLocale("file:///a.jpg", "image/jpeg")).resolves.toEqual({
      tipo: "immagine",
      uri: "file:///a.jpg",
    });
  });

  it("gli altri file su iOS passano dal foglio di condivisione", async () => {
    setOS("ios");
    await apriUriLocale("file:///a.docx", "application/msword");
    expect(Sharing.shareAsync).toHaveBeenCalled();
  });
});

describe("condividiFile", () => {
  it("apre il foglio di condivisione con il tipo del PDF", async () => {
    await condividiFile("file:///a.pdf", "application/pdf");
    expect(Sharing.shareAsync).toHaveBeenCalledWith("file:///a.pdf", {
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf",
    });
  });
});
