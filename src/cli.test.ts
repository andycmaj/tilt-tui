import { describe, test, expect, afterEach } from "bun:test";
import { parsePortFromArgs } from "./cli";

const originalEnv = process.env.TILT_PORT;

afterEach(() => {
  if (originalEnv === undefined) delete process.env.TILT_PORT;
  else process.env.TILT_PORT = originalEnv;
});

describe("parsePortFromArgs", () => {
  test("reads TILT_PORT env when no args (default tui path)", () => {
    process.env.TILT_PORT = "12345";
    expect(parsePortFromArgs([])).toBe(12345);
  });

  test("--port flag takes precedence over env", () => {
    process.env.TILT_PORT = "12345";
    expect(parsePortFromArgs(["--port", "9999"])).toBe(9999);
  });

  test("--port=value form takes precedence over env", () => {
    process.env.TILT_PORT = "12345";
    expect(parsePortFromArgs(["--port=9999"])).toBe(9999);
  });

  test("falls back to default when neither arg nor env set", () => {
    delete process.env.TILT_PORT;
    expect(parsePortFromArgs([])).toBe(10350);
  });
});
