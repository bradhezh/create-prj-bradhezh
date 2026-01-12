import { execSync } from "node:child_process";
import { rm } from "node:fs/promises";
import p from "@clack/prompts";
import { format } from "node:util";

import { meta, useType, useOption, regValue, Conf, Spinner } from "@/registry";
import { setPkgName, setPkgVers, setPkgScript } from "@/command";
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

const run = async (conf: Conf, s: Spinner) => {
  const cwd =
    conf.type !== meta.system.type.monorepo ? "." : conf.mobile!.name!;
  const cmd = format(command.createExpo, conf.npm, cwd);
  p.log.info(cmd);
  s.stop();
  execSync(cmd, { stdio: "inherit" });
  s.start(message.proceed);
  await rm(`${cwd}/.git`, { recursive: true, force: true });
  await setPkgName(conf, conf.mobile!.name!, cwd);
  await setPkgVers(conf, cwd);
  await setPkgScript(conf, script.build.name, script.build.script, cwd);
  await setPkgScript(conf, script.dev.name, script.dev.script, cwd);
};

regValue(
  { name: "expo", label: "Expo", plugin: { run } },
  meta.plugin.option.type.mobile.framework,
  meta.plugin.type.mobile,
);
