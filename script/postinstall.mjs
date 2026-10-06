#!/usr/bin/env node

// Resolves the correct per-platform tilt-tui binary and links it into this
// package's bin/. The matching platform package is installed as an optional
// dependency (via os/cpu fields); if a package manager skipped it, we install
// it on demand into a temp prefix.
import childProcess from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8"));

const platformMap = { darwin: "darwin", linux: "linux" };
const archMap = { x64: "x64", arm64: "arm64" };

const platform = platformMap[os.platform()] ?? os.platform();
const arch = archMap[os.arch()] ?? os.arch();
const name = `@andycmaj/tilt-tui-${platform}-${arch}`;
const targetBinary = path.join(__dirname, "bin", "tilt-tui");

function copyBinary(source, target) {
  if (!fs.existsSync(source)) throw new Error(`Binary not found at ${source}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) fs.unlinkSync(target);
  try {
    fs.linkSync(source, target);
  } catch {
    fs.copyFileSync(source, target);
  }
  fs.chmodSync(target, 0o755);
}

function resolveBinary() {
  const packageJsonPath = require.resolve(`${name}/package.json`);
  return path.join(path.dirname(packageJsonPath), "bin", "tilt-tui");
}

function verifyBinary() {
  const result = childProcess.spawnSync(targetBinary, ["--version"], {
    encoding: "utf8",
    stdio: "ignore",
  });
  return result.status === 0;
}

function installPackage() {
  const version = packageJson.optionalDependencies?.[name];
  if (!version) return false;

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "tilt-tui-install-"));
  try {
    const result = childProcess.spawnSync(
      "npm",
      ["install", "--ignore-scripts", "--no-save", "--loglevel=error", "--prefix", temp, `${name}@${version}`],
      { stdio: "inherit" },
    );
    if (result.status !== 0) return false;
    copyBinary(path.join(temp, "node_modules", name, "bin", "tilt-tui"), targetBinary);
    return true;
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

function main() {
  try {
    copyBinary(resolveBinary(), targetBinary);
    if (verifyBinary()) return;
  } catch {
    if (installPackage() && verifyBinary()) return;
  }

  throw new Error(
    `Failed to install the tilt-tui binary for your platform. Try manually installing "${name}".`,
  );
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
