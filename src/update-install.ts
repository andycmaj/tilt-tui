const REPO = "andycmaj/tilt-tui";

export interface MiseUpdateResult {
  command: string;
  stdout: string;
  stderr: string;
}

export function buildMiseUpdateArgs(tag: string): string[] {
  return ["use", "-g", `github:${REPO}@${tag}`];
}

export function formatMiseUpdateCommand(tag: string): string {
  return `mise ${buildMiseUpdateArgs(tag).join(" ")}`;
}

export async function runMiseUpdate(tag: string): Promise<MiseUpdateResult> {
  const mise = Bun.which("mise");
  if (!mise) {
    console.error("[updater] mise not found on PATH");
    throw new Error("mise not found on PATH");
  }

  const args = buildMiseUpdateArgs(tag);
  const command = `mise ${args.join(" ")}`;
  console.log(`[updater] running: ${command} (mise: ${mise})`);

  const proc = Bun.spawn([mise, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  if (stdout.trim()) console.log(`[updater] stdout:\n${stdout.trim()}`);
  if (stderr.trim()) console.log(`[updater] stderr:\n${stderr.trim()}`);
  console.log(`[updater] exit code: ${exitCode}`);

  if (exitCode !== 0) {
    console.error(
      `[updater] update failed: ${command} exited with ${exitCode}`,
    );
    throw new Error(
      `${command} failed with exit code ${exitCode}${stderr ? `: ${stderr.trim()}` : ""}`,
    );
  }

  console.log(`[updater] update succeeded: ${command}`);
  return { command, stdout, stderr };
}
