import pkg from "../package.json";

declare const TILT_TUI_VERSION: string | undefined;

export const APP_VERSION =
  typeof TILT_TUI_VERSION === "string" && TILT_TUI_VERSION.length > 0
    ? TILT_TUI_VERSION
    : pkg.version;
