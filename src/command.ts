import { exec as execAsync } from "node:child_process";
import { promisify, format } from "node:util";

import { Conf, NPM } from "@/registry";

const exec = promisify(execAsync);

export const command = {
  voltaV: "volta -v",
  nodeV: "node -v",
  npmV: `%s -v`,
  pnpmV: "pnpm -v",
  setPkgName: '%s pkg set name="%s"',
  setPkgVoltaNode: '%s pkg set "volta.node"="%s"',
  setPkgVoltaNpm: '%s pkg set "volta.%s"="%s"',
  setPkgPkgMgr: '%s pkg set packageManager="%s@%s"',
  setPkgScripts: '%s pkg set "scripts.%s"="%s"',
  setPkgDeps: '%s pkg set "dependencies.%s"="%s"',
  setPkgDevDeps: '%s pkg set "devDependencies.%s"="%s"',
  setPkgBin: '%s pkg set "bin.%s"="%s"',
} as const;

export const setPkgName = async (conf: Conf, name: string, cwd?: string) => {
  await exec(format(command.setPkgName, conf.npm, name), { cwd });
};

let volta: boolean | undefined;

export const setPkgVers = async (conf: Conf, cwd?: string) => {
  if (volta === undefined) {
    try {
      await exec(command.voltaV);
      volta = true;
    } catch {
      volta = false;
    }
  }
  if (volta) {
    const node = (await exec(command.nodeV)).stdout.trim();
    await exec(
      format(
        command.setPkgVoltaNode,
        conf.npm,
        !node.startsWith("v") ? node : node.slice(1),
      ),
      { cwd },
    );
    const npm = (await exec(format(command.npmV, conf.npm))).stdout.trim();
    await exec(
      format(
        command.setPkgVoltaNpm,
        conf.npm,
        conf.npm,
        !npm.startsWith("v") ? npm : npm.slice(1),
      ),
      { cwd },
    );
  }

  if (conf.npm === NPM.pnpm) {
    const pnpm = (await exec(command.pnpmV)).stdout.trim();
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
  conf: Conf,
  name: string,
  script: string,
  cwd?: string,
) => {
  await exec(format(command.setPkgScripts, conf.npm, name, script), { cwd });
};

export const setPkgDep = async (
  conf: Conf,
  name: string,
  version: string,
  cwd?: string,
) => {
  await exec(format(command.setPkgDeps, conf.npm, name, version), { cwd });
};

export const setPkgDevDep = async (
  conf: Conf,
  name: string,
  version: string,
  cwd?: string,
) => {
  await exec(format(command.setPkgDevDeps, conf.npm, name, version), { cwd });
};

export const setPkgBin = async (
  conf: Conf,
  name: string,
  cwd?: string,
  script?: string,
) => {
  await exec(
    format(
      command.setPkgBin,
      conf.npm,
      !name.includes("/") ? name : name.split("/").pop(),
      script ?? "dist/index.js",
    ),
    { cwd },
  );
};
