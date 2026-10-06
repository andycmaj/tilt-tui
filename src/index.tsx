// Entry point for Tilt TUI

import { runApp } from "@andycmaj/opentui-app";
import { App } from "./app";
import { parseCLI } from "./cli";
import {
  startTiltProcess,
  isTiltRunning,
  isPortInUse,
  TiltStartError,
} from "./tilt/process";
import { loadUserSettings } from "./config/user-settings";

const config = await parseCLI();

// Load user settings early so the configured tilt binary override is honored
// for process management (and the logs subcommand) before the TUI starts.
const userSettings = await loadUserSettings();
const tiltBinaryPath = userSettings.tiltBinaryPath;

if (config.kind === "logs") {
  const { dumpLogs } = await import("./tilt/dump-logs");
  await dumpLogs(config, tiltBinaryPath);
  process.exit(0);
}

if (config.spawnProcess) {
  if (await isTiltRunning(config.port, tiltBinaryPath)) {
    console.error(`A tilt instance is already running on port ${config.port}`);
    process.exit(1);
  }
  if (await isPortInUse(config.port)) {
    console.error(
      `Port ${config.port} is already in use by another process (not a tilt API).\n` +
        `Pick a different port with --port, or free the port before starting.`,
    );
    process.exit(1);
  }
  try {
    await startTiltProcess(config.tiltArgs, config.port, tiltBinaryPath);
  } catch (err) {
    if (err instanceof TiltStartError) {
      console.error(`Failed to start tilt:\n${err.message}`);
    } else {
      console.error("Failed to start tilt:", err);
    }
    process.exit(1);
  }
}

await runApp(() => <App port={config.port} theme={userSettings.theme} />);
