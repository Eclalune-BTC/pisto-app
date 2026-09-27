import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  platform: { OS: "web" },
  nativeRead: vi.fn(),
  nativeWrite: vi.fn(),
  webRead: vi.fn(),
  webWrite: vi.fn(),
}));

vi.mock("react-native", () => ({ Platform: fixture.platform }));
vi.mock("expo-secure-store", () => ({
  getItemAsync: fixture.nativeRead,
  setItemAsync: fixture.nativeWrite,
}));

import {
  parseAppearanceChoice,
  readAppearancePreference,
  writeAppearancePreference,
} from "../appearance-preference";

beforeEach(() => {
  vi.resetAllMocks();
  fixture.platform.OS = "web";
  fixture.webRead.mockReturnValue(null);
  fixture.nativeRead.mockResolvedValue(null);
  vi.stubGlobal("window", {
    localStorage: { getItem: fixture.webRead, setItem: fixture.webWrite },
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("appearance persistence", () => {
  test.each(["web", "ios", "android"])(
    "uses the system only for an absent %s preference",
    async (platform) => {
      fixture.platform.OS = platform;
      expect(await readAppearancePreference()).toBe("system");
      fixture.webRead.mockReturnValue("invalid");
      fixture.nativeRead.mockResolvedValue("invalid");
      await expect(readAppearancePreference()).rejects.toThrow(
        "Stored appearance preference is invalid",
      );
    },
  );

  test.each(["light", "dark", "system"] as const)(
    "stores and reads the explicit web choice %s",
    async (choice) => {
      await writeAppearancePreference(choice);
      expect(fixture.webWrite).toHaveBeenCalledExactlyOnceWith("pisto.appearance", choice);
      fixture.webRead.mockReturnValue(choice);
      expect(await readAppearancePreference()).toBe(choice);
      expect(fixture.nativeWrite).not.toHaveBeenCalled();
    },
  );

  test.each(["ios", "android"])(
    "reuses SecureStore on %s without requesting authentication",
    async (platform) => {
      fixture.platform.OS = platform;
      await writeAppearancePreference("dark");
      expect(fixture.nativeWrite).toHaveBeenCalledExactlyOnceWith("pisto.appearance", "dark");
      fixture.nativeRead.mockResolvedValue("dark");
      expect(await readAppearancePreference()).toBe("dark");
      expect(fixture.webWrite).not.toHaveBeenCalled();
    },
  );

  test("propagates blocked storage instead of claiming a preference was saved", async () => {
    fixture.webWrite.mockImplementation(() => {
      throw new Error("Storage blocked");
    });
    fixture.webRead.mockImplementation(() => {
      throw new Error("Storage blocked");
    });
    await expect(writeAppearancePreference("dark")).rejects.toThrow("Storage blocked");
    await expect(readAppearancePreference()).rejects.toThrow("Storage blocked");
  });

  test("does not accept misspelled choices", () => {
    for (const value of ["", "Dark", "auto", "dark "])
      expect(() => parseAppearanceChoice(value)).toThrow();
  });
});
