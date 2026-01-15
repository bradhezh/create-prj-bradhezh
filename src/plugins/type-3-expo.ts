import { execSync } from "node:child_process";
import { rm, access } from "node:fs/promises";
import path from "node:path";
import p from "@clack/prompts";
import { format } from "node:util";

import { value } from "./const";
import { useType, useOption, regValue, meta, Conf, Spinner } from "@/registry";
import {
  setPkgName,
  setPkgVers,
  setPkgScript,
  setMonoPathAlias,
} from "@/command";
import { message } from "@/message";

useType(meta.plugin.type.mobile, "Mobile");
useOption(
  meta.plugin.option.type.common.name,
  "Mobile name",
  meta.system.option.category.type,
  meta.plugin.type.mobile,
);
useOption(
  meta.plugin.option.type.mobile.framework,
  "Mobile framework",
  meta.system.option.category.type,
  meta.plugin.type.mobile,
);

const command = { createExpo: "%s create expo-app %s --no-install" } as const;

const script = {
  build: {
    name: "build",
    script: "eas build --platform android --profile development",
  },
  dev: {
    name: "dev",
    script: "expo start",
  },
} as const;

const git = ".git" as const;

const run = async (conf: Conf, s: Spinner) => {
  const npm = conf.npm;
  const name = conf.mobile!.name!;
  const type = conf.type;
  const cwd = type !== meta.system.type.monorepo ? "." : name;

  const cmd = format(command.createExpo, npm, cwd);
  p.log.info(cmd);
  s.stop();
  execSync(cmd, { stdio: "inherit" });
  s.start(message.proceed);
  await rm(path.join(cwd, git), { recursive: true, force: true });
  await setPkgName(npm, name, cwd);
  await setPkgVers(npm, cwd);
  await setPkgScript(npm, script.build.name, script.build.script, cwd);
  await setPkgScript(npm, script.dev.name, script.dev.script, cwd);
  if (
    type === meta.system.type.monorepo &&
    (await access(meta.system.type.shared)
      .then(() => true)
      .catch(() => false))
  ) {
    await setMonoPathAlias(name);
  }
};

regValue(
  {
    name: value.mobile.framework.expo,
    label: "Expo",
    plugin: { run },
    disables: [
      { option: meta.plugin.option.builder },
      /*
      { option: meta.plugin.option.typescript },
      { option: meta.plugin.option.test },
      { option: meta.plugin.option.lint },
      { option: meta.plugin.option.orm },
      */
    ],
    enables: [],
  },
  meta.plugin.option.type.mobile.framework,
  meta.plugin.type.mobile,
);
