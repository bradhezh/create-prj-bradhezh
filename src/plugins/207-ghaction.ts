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
  const lint = conf.lint ? "lint" : undefined;
  const test = conf.test ? "test" : undefined;
  const beName = conf.backend?.name ?? meta.plugin.type.backend;
  const beCwd = conf.type !== meta.plugin.type.monorepo ? "." : beName;

  await install(beDeploy, beDeploySrc, feDeploy, mDeploy, lint, test);
  await setRepo(beDeploySrc, beName, beCwd);

  log.info(format(message.pluginFinish, this.label));
  s.stop();
}

const install = async (
  beDeploy: DeployValue,
  beDeploySrc: DeploySrcValue,
  feDeploy: DeployValue,
  mDeploy: DeployValue,
  lint: Lint,
  test: Test,
) => {
  if (!beDeploy && !feDeploy && !mDeploy) {
    const tmplt = template[lint ?? "default"] ?? template.default!;
    await installTmplt(base, tmplt, test, ".", true);
  } else if (!beDeploy) {
    const tmplt = femTmplt[feDeploy ?? "default"] ?? femTmplt.default!;
    await installTmplt(base, tmplt, mDeploy, ".", true);
  } else if (beDeploy === value.deployment.render) {
    if (beDeploySrc === value.deploySrc.docker) {
      const tmplt =
        beRenderWithDkrTmplt[feDeploy ?? "default"] ??
        beRenderWithDkrTmplt.default!;
      await installTmplt(base, tmplt, mDeploy, ".", true);
    }
  }
};

const setRepo = async (
  beDeploySrc: DeploySrcValue,
  beName: string,
  beCwd: string,
) => {
  await exec(command.gitAdd);
  await exec(command.gitCi);
  await exec(command.gitPush);
  if (beDeploySrc === value.deploySrc.docker) {
    await exec(format(command.setVar, beNameVar, beName));
    await setEnvSecs(beCwd, testEnv);
  }
};

const setEnvSecs = async (cwd: string, env: string) => {
  const lines = (await readFile(join(cwd, env), "utf-8").catch(() => "")).split(
    /\r?\n/,
  );
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

type Lint = "lint" | undefined;
type Test = "test" | undefined;

const base =
  "https://raw.githubusercontent.com/bradhezh/prj-template/master/ghaction" as const;

const template: Partial<
  Record<NonNullable<Lint> | "default", Template<NonNullable<Test>>>
> = {
  lint: {
    test: { name: "workflow.tar", path: "/lint-test/workflow.tar" },
    default: { name: "workflow.tar", path: "/lint/workflow.tar" },
  },
  default: {
    test: { name: "workflow.tar", path: "/test/workflow.tar" },
    default: { name: "workflow.tar", path: "/workflow.tar" },
  },
} as const;

const femTmplt: Partial<
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
  },
} as const;

const beRenderWithDkrTmplt: Partial<
  Record<
    NonNullable<DeployValue> | "default",
    Template<NonNullable<DeployValue>>
  >
> = {
  vercel: {
    expo: { name: "workflow.tar", path: "/be-render/vercel/expo/workflow.tar" },
    default: { name: "workflow.tar", path: "/be-render/vercel/workflow.tar" },
  },
  default: {
    expo: { name: "workflow.tar", path: "/be-render/expo/workflow.tar" },
    default: { name: "workflow.tar", path: "/be-render/workflow.tar" },
  },
};

const command = {
  gitAdd: "git add .",
  gitCi: 'git commit -m "github workflow added"',
  gitPush: "git push",
  setVar: "gh variable set %s --body %s",
} as const;

const beNameVar = "BACKEND_NAME" as const;
const testEnv = ".env.test" as const;
