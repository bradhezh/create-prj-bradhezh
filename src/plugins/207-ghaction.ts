import { exec as execAsync, execFile } from "node:child_process";
import { promisify, format } from "node:util";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { log, spinner } from "@clack/prompts";

import { option, value, DeployValue, DeploySrcValue } from "./const";
import { regValue, meta, Conf, Plugin } from "@/registry";
import { installTmplt, Template } from "@/command";
import { message } from "@/message";

async function run(this: Plugin, conf: Conf) {
  const s = spinner();
  s.start();
  log.info(format(message.pluginStart, this.label));

  const beDeploy = conf.backend?.deployment as DeployValue;
  const beDeploySrc = conf.backend?.[option.deploySrc] as DeploySrcValue;
  const beCwd =
    (conf.type !== meta.plugin.type.backend &&
      conf.type !== meta.plugin.type.monorepo) ||
    (conf.type === meta.plugin.type.monorepo &&
      !conf.monorepo?.types.includes(meta.plugin.type.backend))
      ? undefined
      : conf.type === meta.plugin.type.backend
        ? "."
        : (conf.backend?.name ?? meta.plugin.type.backend);
  const feDeploy = (
    conf.frontend?.framework === value.framework.react
      ? conf.frontend?.[option.reactDeploy]
      : conf.frontend?.framework === value.framework.next
        ? conf.frontend?.[option.nextDeploy]
        : undefined
  ) as DeployValue;
  const mDeploy = (
    conf.mobile?.framework === value.framework.expo
      ? conf.mobile?.[option.expoDeploy]
      : undefined
  ) as DeployValue;

  await install(beDeploy, beDeploySrc, feDeploy, mDeploy);
  await setRepo(beCwd);

  log.info(format(message.pluginFinish, this.label));
  s.stop();
}

const install = async (
  beDeploy: DeployValue,
  beDeploySrc: DeploySrcValue,
  feDeploy: DeployValue,
  mDeploy: DeployValue,
) => {
  if (!beDeploy) {
    const tmplt = template[feDeploy ?? "default"] ?? template.default!;
    await installTmplt(base, tmplt, mDeploy ?? "default", ".", true);
  } else if (beDeploy === value.deployment.render) {
    const tmplt =
      beRenderTmplt[beDeploySrc ?? "default"] ?? beRenderTmplt.default!;
    const tmplt0 = tmplt[feDeploy ?? "default"] ?? tmplt.default!;
    await installTmplt(base, tmplt0, mDeploy ?? "default", ".", true);
  }
};

const setRepo = async (beCwd?: string) => {
  await exec(command.gitAdd);
  await exec(command.gitCi);
  await exec(command.gitPush);
  await setEnvSecs(beCwd);
};

const setEnvSecs = async (beCwd?: string) => {
  if (!beCwd) {
    return;
  }
  const lines = (await readFile(join(beCwd, env), "utf-8")).split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.startsWith("#")) {
      continue;
    }
    const [name, ...parts] = line.split("=");
    const key = name.trim();
    const value = parts.join("=").trim();
    if (!key || !value) {
      continue;
    }
    await execf("gh", ["secret", "set", key, "--body", value]);
  }
};

const label = "GitHub Actions" as const;

regValue(
  {
    name: value.cicd.ghaction,
    label,
    skips: [],
    keeps: [],
    requires: [],
    plugin: {
      name: `${meta.plugin.option.cicd}_${value.cicd.ghaction}`,
      label,
      run,
    },
  },
  meta.plugin.option.cicd,
);

const exec = promisify(execAsync);
const execf = promisify(execFile);

const base =
  "https://raw.githubusercontent.com/bradhezh/prj-template/master/ghaction" as const;

const template: Partial<
  Record<
    NonNullable<DeployValue> | "default",
    Template<NonNullable<DeployValue>>
  >
> = {
  vercel: {
    expo: { name: "workflow.tar", path: "/vercel/expo/workflow.tar" },
    default: { name: "workflow.tar", path: "/vercel/workflow.tar" },
  },
  default: {
    expo: { name: "workflow.tar", path: "/expo/workflow.tar" },
    default: { name: "workflow.tar", path: "/workflow.tar" },
  },
} as const;

const beRenderTmplt: Partial<
  Record<
    NonNullable<DeploySrcValue> | "default",
    Partial<
      Record<
        NonNullable<DeployValue> | "default",
        Template<NonNullable<DeployValue>>
      >
    >
  >
> = {
  default: {
    vercel: {
      expo: { name: "workflow.tar", path: "/render/vercel/expo/workflow.tar" },
      default: { name: "workflow.tar", path: "/render/vercel/workflow.tar" },
    },
    default: {
      expo: { name: "workflow.tar", path: "/render/expo/workflow.tar" },
      default: { name: "workflow.tar", path: "/render/workflow.tar" },
    },
  },
};

const command = {
  gitAdd: "git add .",
  gitCi: 'git commit -m "github workflow added"',
  gitPush: "git push",
} as const;

const env = ".env.test" as const;
