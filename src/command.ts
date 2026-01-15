import { exec as execAsync } from "node:child_process";
import { promisify, format } from "node:util";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import Json from "comment-json";

import { NPM } from "@/registry";

const exec = promisify(execAsync);

export const command = {
  volta: "volta -v",
  node: "node -v",
  npm: `%s -v`,
  pnpm: "pnpm -v",
  setPkgName: '%s pkg set name="%s"',
  setPkgVoltaNode: '%s pkg set "volta.node"="%s"',
  setPkgVoltaNpm: '%s pkg set "volta.%s"="%s"',
  setPkgPkgMgr: '%s pkg set packageManager="%s@%s"',
  setPkgScripts: '%s pkg set "scripts.%s"="%s"',
  setPkgDeps: '%s pkg set "dependencies.%s"="%s"',
  setPkgDevDeps: '%s pkg set "devDependencies.%s"="%s"',
  setPkgBin: '%s pkg set "bin.%s"="%s"',
} as const;

export const setPkgName = async (npm: NPM, name: string, cwd?: string) => {
  await exec(format(command.setPkgName, npm, name), { cwd });
};

let volta: boolean | undefined;

export const setPkgVers = async (npm: NPM, cwd?: string) => {
  void (
    volta !== undefined ||
    (volta = await exec(command.volta)
      .then(() => true)
      .catch(() => false))
  );
  if (volta) {
    const node = (await exec(command.node)).stdout.trim();
    await exec(
      format(
        command.setPkgVoltaNode,
        npm,
        !node.startsWith("v") ? node : node.slice(1),
      ),
      { cwd },
    );
    const npmV = (await exec(format(command.npm, npm))).stdout.trim();
    await exec(
      format(
        command.setPkgVoltaNpm,
        npm,
        npm,
        !npmV.startsWith("v") ? npmV : npmV.slice(1),
      ),
      { cwd },
    );
  }

  if (npm === NPM.pnpm) {
    const pnpm = (await exec(command.pnpm)).stdout.trim();
    await exec(
      format(
        command.setPkgPkgMgr,
        NPM.pnpm,
        NPM.pnpm,
        !pnpm.startsWith("v") ? pnpm : pnpm.slice(1),
      ),
      { cwd },
    );
  }
};

export const setPkgScript = async (
  npm: NPM,
  name: string,
  script: string,
  cwd?: string,
) => {
  await exec(format(command.setPkgScripts, npm, name, script), { cwd });
};

export const setPkgDep = async (
  npm: NPM,
  name: string,
  version: string,
  cwd?: string,
) => {
  await exec(format(command.setPkgDeps, npm, name, version), { cwd });
};

export const setPkgDevDep = async (
  npm: NPM,
  name: string,
  version: string,
  cwd?: string,
) => {
  await exec(format(command.setPkgDevDeps, npm, name, version), { cwd });
};

export const setPkgBin = async (
  npm: NPM,
  name: string,
  cwd?: string,
  script?: string,
) => {
  await exec(
    format(
      command.setPkgBin,
      npm,
      !name.includes("/") ? name : name.split("/").pop(),
      script ?? "dist/index.js",
    ),
    { cwd },
  );
};

const tsconfig = "tsconfig.json" as const;

const pathAlias = {
  "@/*": ["%s/src/*"],
  "@shared/*": ["shared/src/*"],
};

export const setMonoPathAlias = async (cwd: string) => {
  const file = path.join(cwd, tsconfig);
  pathAlias["@/*"][0] = format(pathAlias["@/*"][0], cwd);
  const doc = Json.parse(await readFile(file, "utf8")) as any;
  void (doc.compilerOptions || (doc.compilerOptions = {}));
  doc.compilerOptions.baseUrl = "..";
  doc.compilerOptions.paths = pathAlias;
  const text = Json.stringify(doc, null, 2).replace(
    /\[\s+"([^"]+)"\s+\]/g,
    '["$1"]',
  );
  await writeFile(file, text);
};
