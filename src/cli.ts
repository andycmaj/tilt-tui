import { defineCommand, runMain } from "citty";
import { APP_VERSION } from "./version";

export interface TuiConfig {
  kind: "tui";
  spawnProcess: boolean;
  /** Everything after "up" -- passed verbatim to `tilt up`. */
  tiltArgs: string[];
  port: number;
}

const DEFAULT_TILT_PORT = 10350;

export interface LogsConfig {
  kind: "logs";
  /** Resource name to filter logs for. Empty string means all resources. */
  resource: string;
  /** Stream new logs continuously instead of dumping and exiting. */
  follow: boolean;
  host: string;
  port: number;
}

export type CLIConfig = TuiConfig | LogsConfig;

let config: CLIConfig | undefined = undefined;

const upCommand = defineCommand({
  meta: { name: "up", description: "Start tilt and connect to it" },
  run({ rawArgs }) {
    config = {
      kind: "tui",
      spawnProcess: true,
      tiltArgs: rawArgs,
      port: parsePortFromArgs(rawArgs),
    };
  },
});

const logsCommand = defineCommand({
  meta: { name: "logs", description: "Dump logs from a running tilt instance" },
  args: {
    resource: {
      type: "positional",
      description: "Resource name to filter logs for",
      required: false,
      default: "",
    },
    follow: {
      type: "boolean",
      alias: "f",
      description: "Stream new logs continuously",
      default: false,
    },
    host: {
      type: "string",
      description: "Tilt API host",
      default: "localhost",
    },
    port: {
      type: "string",
      description: "Tilt API port",
    },
  },
  run({ args, rawArgs }) {
    config = {
      kind: "logs",
      resource: args.resource,
      follow: args.follow,
      host: args.host,
      port: parsePortFromArgs(rawArgs),
    };
  },
});

const main = defineCommand({
  meta: {
    name: "tilt-tui",
    version: APP_VERSION,
    description: "A terminal UI for Tilt",
  },
  subCommands: { up: upCommand, logs: logsCommand },
  run() {
    if (!config) {
      config = {
        kind: "tui",
        spawnProcess: false,
        tiltArgs: [],
        port: parsePortFromArgs([]),
      };
    }
  },
});

export async function parseCLI(): Promise<CLIConfig> {
  await runMain(main);
  // citty handles --version/--help by printing and returning without invoking
  // run(), leaving config unset. Nothing to do in that case, so exit cleanly.
  if (!config) {
    process.exit(0);
  }
  return config;
}

export function parsePortFromArgs(args: string[]): number {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--port" && i + 1 < args.length) {
      const parsed = parseInt(args[i + 1], 10);
      if (!Number.isNaN(parsed)) return parsed;
    } else if (arg.startsWith("--port=")) {
      const parsed = parseInt(arg.slice("--port=".length), 10);
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  const envPort = parseInt(process.env.TILT_PORT ?? "", 10);
  if (!Number.isNaN(envPort)) return envPort;
  return DEFAULT_TILT_PORT;
}
