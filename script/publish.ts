#!/usr/bin/env bun

// Assembles and publishes the cross-platform npm package set:
//   - one per-platform package per built binary (already emitted under dist/)
//   - a main @andycmaj/tilt-tui package whose postinstall links the
//     correct platform binary into bin/
// Registry auth: the repo-root .npmrc points at the CodeArtifact registry and
// reads the token from ${CODEARTIFACT_AUTH_TOKEN}, which the CodeArtifact login
// action exports into the environment. npm only reads .npmrc from the cwd, so
// publish() must run from the repo root, not from the per-package dir.
import path from "path";
import { $ } from "bun";
import { fileURLToPath } from "url";

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(dir);

const MAIN_NAME = "@andycmaj/tilt-tui";

async function published(name: string, version: string): Promise<boolean> {
  return (await $`npm view ${name}@${version} version`.nothrow()).exitCode === 0;
}

async function publish(packageDir: string, name: string, version: string) {
  if (process.platform !== "win32") await $`chmod -R 755 .`.cwd(packageDir);
  if (await published(name, version)) {
    console.log(`already published ${name}@${version}`);
    return;
  }
  // Run from repo root (not .cwd(packageDir)) so npm reads the root .npmrc
  // for the CodeArtifact registry + auth token; a per-package dir has none.
  // Pass an absolute path so npm treats it as a folder, not a "user/repo"
  // GitHub shorthand spec (which a bare "dist/tilt-tui-*" would parse as).
  await $`npm publish ${path.resolve(packageDir)} --access restricted`;
  console.log(`published ${name}@${version}`);
}

// Collect the per-platform packages from dist.
const binaries: Record<string, string> = {};
const dirs: Record<string, string> = {};
for (const filepath of new Bun.Glob("*/package.json").scanSync({ cwd: "./dist" })) {
  const pkg = await Bun.file(`./dist/${filepath}`).json();
  binaries[pkg.name] = pkg.version;
  dirs[pkg.name] = path.join("./dist", path.dirname(filepath));
}

const version = Object.values(binaries)[0];
if (!version) throw new Error("No built binaries found under dist/");
console.log("binaries", binaries);

// Assemble the main package.
const mainDir = "./dist/main-package";
await $`rm -rf ${mainDir}`;
await $`mkdir -p ${mainDir}/bin`;
await $`cp ./script/postinstall.mjs ${mainDir}/postinstall.mjs`;

// bin stub replaced by postinstall; errors if scripts were skipped.
await Bun.file(`${mainDir}/bin/tilt-tui`).write(
  [
    "#!/usr/bin/env node",
    'console.error("Error: @andycmaj/tilt-tui postinstall did not run.");',
    'console.error("Reinstall without --ignore-scripts, or run node postinstall.mjs manually.");',
    "process.exit(1);",
    "",
  ].join("\n"),
);

await Bun.file(`${mainDir}/package.json`).write(
  JSON.stringify(
    {
      name: MAIN_NAME,
      version,
      bin: { "tilt-tui": "./bin/tilt-tui" },
      scripts: { postinstall: "node ./postinstall.mjs" },
      os: ["darwin", "linux"],
      cpu: ["arm64", "x64"],
      optionalDependencies: binaries,
    },
    null,
    2,
  ) + "\n",
);

// Publish platform packages first, then the main package.
for (const [name, ver] of Object.entries(binaries)) {
  await publish(dirs[name], name, ver);
}
await publish(mainDir, MAIN_NAME, version);
