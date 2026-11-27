import { describe, test, expect } from "bun:test";
import { parseSearchQuery, searchHeaderLabel } from "../utils/log-search-utils";

describe("parseSearchQuery", () => {
  test("returns null for empty string", () => {
    expect(parseSearchQuery("")).toBeNull();
  });

  test("returns null for whitespace-only string", () => {
    expect(parseSearchQuery("   ")).toBeNull();
  });

  test("parses simple string query", () => {
    const result = parseSearchQuery("hello");
    expect(result).not.toBeNull();
    expect(result!.query).toBe("hello");
    expect(result!.isRegex).toBe(false);
    expect(result!.regex).toBeNull();
  });

  test("trims whitespace from query", () => {
    const result = parseSearchQuery("  hello  ");
    expect(result!.query).toBe("hello");
  });

  test("parses regex syntax /pattern/", () => {
    const result = parseSearchQuery("/error/");
    expect(result!.isRegex).toBe(true);
    expect(result!.regex).not.toBeNull();
    expect(result!.regex!.test("error")).toBe(true);
    expect(result!.regex!.test("ERROR")).toBe(true); // default case-insensitive
  });

  test("parses regex with flags /pattern/gi", () => {
    const result = parseSearchQuery("/error/g");
    expect(result!.isRegex).toBe(true);
    expect(result!.regex!.flags).toContain("g");
  });

  test("falls back to string match for invalid regex", () => {
    const result = parseSearchQuery("/[invalid/");
    expect(result!.isRegex).toBe(false);
    expect(result!.regex).toBeNull();
    expect(result!.query).toBe("/[invalid/");
  });

  test("treats single slash as string, not regex", () => {
    const result = parseSearchQuery("/path/to/file");
    expect(result!.isRegex).toBe(false);
    expect(result!.query).toBe("/path/to/file");
  });

  test("parses regex with complex pattern", () => {
    const result = parseSearchQuery("/Error:\\s+\\w+/i");
    expect(result!.isRegex).toBe(true);
    expect(result!.regex!.test("Error: something")).toBe(true);
    expect(result!.regex!.test("error: thing")).toBe(true);
    expect(result!.regex!.test("Warning: something")).toBe(false);
  });
});

describe("searchHeaderLabel", () => {
  test("shows a regex query once, with only its own slashes", () => {
    const filter = parseSearchQuery("/GET \\/v1/")!;
    expect(searchHeaderLabel(filter, 1)).toBe("[/GET \\/v1/: 1 matches]");
  });

  test("keeps regex flags", () => {
    const filter = parseSearchQuery("/error/i")!;
    expect(searchHeaderLabel(filter, 3)).toBe("[/error/i: 3 matches]");
  });

  test("shows a plain query as typed, without regex slashes", () => {
    const filter = parseSearchQuery("hello")!;
    expect(searchHeaderLabel(filter, 0)).toBe("[hello: 0 matches]");
  });
});
