import { describe, expect, it } from "vitest";
import {
  detectRoutineFormat,
  isBlockedAddress,
  normalizeRoutineUrl,
  RoutineFetchError,
} from "./fetch-routine";

describe("normalizeRoutineUrl", () => {
  it("rewrites a Google Sheets edit link to a CSV export of the same tab", () => {
    const url = normalizeRoutineUrl("https://docs.google.com/spreadsheets/d/abc123/edit#gid=42");
    expect(url.toString()).toBe(
      "https://docs.google.com/spreadsheets/d/abc123/export?format=csv&gid=42",
    );
  });

  it("rewrites GitHub blob, Gist and Dropbox share links to raw downloads", () => {
    expect(normalizeRoutineUrl("https://github.com/me/repo/blob/main/r/plan.json").toString()).toBe(
      "https://raw.githubusercontent.com/me/repo/main/r/plan.json",
    );
    expect(normalizeRoutineUrl("https://gist.github.com/me/0f1e").toString()).toBe(
      "https://gist.githubusercontent.com/me/0f1e/raw",
    );
    expect(
      normalizeRoutineUrl("https://www.dropbox.com/s/x/plan.csv?dl=0").searchParams.get("dl"),
    ).toBe("1");
  });

  it.each([
    ["not a url", "no es una URL"],
    ["http://example.com/plan.json", "https://"],
    ["file:///etc/passwd", "https://"],
    ["https://user:pw@example.com/plan.json", "usuario"],
    ["https://example.com:8443/plan.json", "puerto"],
  ])("rejects %s", (raw, reason) => {
    expect(() => normalizeRoutineUrl(raw)).toThrow(RoutineFetchError);
    expect(() => normalizeRoutineUrl(raw)).toThrow(reason);
  });
});

describe("isBlockedAddress", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.20.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "0.0.0.0",
    "::1",
    "fd00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "garbage",
  ])("blocks %s", (addr) => expect(isBlockedAddress(addr)).toBe(true));

  it.each(["8.8.8.8", "142.250.80.46", "2606:4700:4700::1111"])("allows %s", (addr) =>
    expect(isBlockedAddress(addr)).toBe(false),
  );
});

describe("detectRoutineFormat", () => {
  it("treats an object as JSON and anything else as CSV", () => {
    expect(detectRoutineFormat('  {"name":"x"}')).toBe("json");
    expect(detectRoutineFormat("planName,dayName\n")).toBe("csv");
  });
});
