export const LATEST_RELEASE_URL =
  "https://api.github.com/repos/andycmaj/tilt-tui/releases/latest";
const REPO = "andycmaj/tilt-tui";

export interface LatestRelease {
  version: string;
  tagName: string;
  htmlUrl: string;
  name?: string;
}

export type UpdateInfo =
  | {
      status: "idle" | "loading" | "error";
      currentVersion: string;
    }
  | {
      status: "current" | "update-available";
      currentVersion: string;
      latest: LatestRelease;
    };

interface GitHubReleasePayload {
  tag_name: string;
  html_url: string;
  name?: unknown;
}

interface ParsedSemver {
  major: number;
  minor: number;
  patch: number;
  prerelease: string | null;
}

export function normalizeVersionTag(tag: string): string {
  return tag.trim().replace(/^v/i, "");
}

export function compareSemver(a: string, b: string): number {
  const left = parseSemver(a);
  const right = parseSemver(b);

  if (!left && !right) return 0;
  if (!left) return -1;
  if (!right) return 1;

  for (const key of ["major", "minor", "patch"] as const) {
    if (left[key] !== right[key]) return left[key] - right[key];
  }

  if (left.prerelease === right.prerelease) return 0;
  if (left.prerelease === null) return 1;
  if (right.prerelease === null) return -1;
  return left.prerelease.localeCompare(right.prerelease);
}

export function parseLatestRelease(value: unknown): LatestRelease | null {
  if (!isReleasePayload(value)) return null;

  const tagName = value.tag_name.trim();
  const htmlUrl = value.html_url.trim();
  if (!tagName || !htmlUrl) return null;

  return {
    version: normalizeVersionTag(tagName),
    tagName,
    htmlUrl,
    name:
      typeof value.name === "string" && value.name.trim().length > 0
        ? value.name.trim()
        : undefined,
  };
}

export function decideUpdateInfo(
  currentVersion: string,
  latest: LatestRelease | null,
): UpdateInfo {
  if (!latest) {
    return { status: "error", currentVersion };
  }

  if (compareSemver(latest.version, currentVersion) > 0) {
    return { status: "update-available", currentVersion, latest };
  }

  return { status: "current", currentVersion, latest };
}

export async function getUpdateInfo(
  currentVersion: string,
): Promise<UpdateInfo> {
  const latest = await getLatestRelease();
  return decideUpdateInfo(currentVersion, latest);
}

async function getLatestRelease(): Promise<LatestRelease | null> {
  const apiRelease = await getLatestReleaseFromApi();
  if (apiRelease) return apiRelease;
  return getLatestReleaseFromGh();
}

async function getLatestReleaseFromApi(): Promise<LatestRelease | null> {
  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
    };
    const token = getGitHubToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(LATEST_RELEASE_URL, {
      headers,
    });

    if (!response.ok) {
      return null;
    }

    return parseLatestRelease(await response.json());
  } catch {
    return null;
  }
}

async function getLatestReleaseFromGh(): Promise<LatestRelease | null> {
  const gh = Bun.which("gh");
  if (!gh) return null;

  try {
    const proc = Bun.spawn(
      [gh, "release", "view", "--repo", REPO, "--json", "tagName,url,name"],
      {
        stdout: "pipe",
        stderr: "ignore",
      },
    );
    const [exitCode, stdout] = await Promise.all([
      proc.exited,
      new Response(proc.stdout).text(),
    ]);

    if (exitCode !== 0) return null;
    return parseGhRelease(JSON.parse(stdout));
  } catch {
    return null;
  }
}

function parseSemver(value: string): ParsedSemver | null {
  const match = normalizeVersionTag(value).match(
    /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/,
  );
  if (!match) return null;

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? null,
  };
}

function parseGhRelease(value: unknown): LatestRelease | null {
  if (!isGhReleasePayload(value)) return null;

  const tagName = value.tagName.trim();
  const htmlUrl = value.url.trim();
  if (!tagName || !htmlUrl) return null;

  return {
    version: normalizeVersionTag(tagName),
    tagName,
    htmlUrl,
    name:
      typeof value.name === "string" && value.name.trim().length > 0
        ? value.name.trim()
        : undefined,
  };
}

function getGitHubToken(): string | null {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  return token && token.trim().length > 0 ? token.trim() : null;
}

function isReleasePayload(value: unknown): value is GitHubReleasePayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "tag_name" in value &&
    "html_url" in value &&
    typeof value.tag_name === "string" &&
    typeof value.html_url === "string"
  );
}

function isGhReleasePayload(
  value: unknown,
): value is { tagName: string; url: string; name?: unknown } {
  return (
    typeof value === "object" &&
    value !== null &&
    "tagName" in value &&
    "url" in value &&
    typeof value.tagName === "string" &&
    typeof value.url === "string"
  );
}
