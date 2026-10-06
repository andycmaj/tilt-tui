// User Settings - loads and manages user configuration from ~/.config/tilt-tui/config.json

import {
  createConfigStore,
  THEME_NAMES,
  type ThemeName,
} from "@andycmaj/opentui-app";

export function parseThemeName(value: unknown): ThemeName {
  if (typeof value === "string" && THEME_NAMES.includes(value as ThemeName)) {
    return value as ThemeName;
  }
  if (value !== undefined) {
    console.error(
      `Invalid theme "${String(value)}" in config; expected one of ${THEME_NAMES.join(", ")}. Using "default".`,
    );
  }
  return "default";
}

/**
 * Log filter configuration - maps filter name to array of regex patterns.
 * Each pattern is matched against log line text.
 */
export interface LogFilters {
  [name: string]: string[];
}

/**
 * User settings loaded from config file.
 */
export interface UserSettings {
  /** Named log filters with regex patterns to ignore matching log lines */
  logFilters?: LogFilters;
  /** Override path to the tilt binary (otherwise discovered on PATH) */
  tiltBinaryPath?: string;
  /** Color scheme: "default" (dark), "terminal" (use terminal colors), or "mono" (no color) */
  theme?: ThemeName;
}

/**
 * Compiled log filters with pre-built RegExp objects for performance.
 */
export interface CompiledLogFilters {
  /** Filter name for display */
  name: string;
  /** Compiled regex patterns */
  patterns: RegExp[];
}

/**
 * Runtime representation of user settings with compiled regexes.
 */
export interface RuntimeSettings {
  /** Original settings from config file */
  raw: UserSettings;
  /** Compiled log filters ready for matching */
  logFilters: CompiledLogFilters[];
  /** Names of active log filters for display */
  activeFilterNames: string[];
  /** Override path to the tilt binary, if configured */
  tiltBinaryPath?: string;
  /** Selected color scheme (defaults to "default"). */
  theme: ThemeName;
}

const store = createConfigStore<UserSettings, RuntimeSettings>({
  appName: "tilt-tui",
  compile: compileSettings,
  defaults: createDefaultSettings,
});

/**
 * Load user settings from ~/.config/tilt-tui/config.json.
 * Returns default empty settings if file doesn't exist or is invalid.
 */
export const loadUserSettings = store.load;

/**
 * Create default empty settings.
 */
function createDefaultSettings(): RuntimeSettings {
  return {
    raw: {},
    logFilters: [],
    activeFilterNames: [],
    theme: "default",
  };
}

/**
 * Compile raw settings into runtime settings with pre-built RegExp objects.
 */
function compileSettings(settings: Partial<UserSettings>): RuntimeSettings {
  const logFilters: CompiledLogFilters[] = [];
  const activeFilterNames: string[] = [];

  if (settings.logFilters) {
    for (const [name, patterns] of Object.entries(settings.logFilters)) {
      const compiledPatterns: RegExp[] = [];

      for (const pattern of patterns) {
        try {
          compiledPatterns.push(new RegExp(pattern));
        } catch (error) {
          console.error(
            `Invalid regex pattern "${pattern}" in filter "${name}":`,
            error,
          );
        }
      }

      if (compiledPatterns.length > 0) {
        logFilters.push({ name, patterns: compiledPatterns });
        activeFilterNames.push(name);
      }
    }
  }

  return {
    raw: settings,
    logFilters,
    activeFilterNames,
    tiltBinaryPath: settings.tiltBinaryPath,
    theme: parseThemeName(settings.theme),
  };
}

/**
 * Check if a log line text matches any of the compiled filters.
 * Returns true if the line should be filtered (ignored).
 */
export function shouldFilterLogLine(
  text: string,
  filters: CompiledLogFilters[],
): boolean {
  for (const filter of filters) {
    for (const pattern of filter.patterns) {
      if (pattern.test(text)) {
        return true;
      }
    }
  }
  return false;
}
