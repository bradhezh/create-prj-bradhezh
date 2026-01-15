/*
import { execSync } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";
import p from "@clack/prompts";
import { format } from "node:util";
*/

import { value } from "./const";
import { useOption, regValue, meta, Conf } from "@/registry";
/*
import {
  setPkgName,
  setPkgVers,
  setPkgScript,
  setMonoPathAlias,
} from "@/command";
import { message } from "@/message";
*/

useOption(
  meta.plugin.option.builder,
  "Builder",
  meta.system.option.category.compulsory,
);

/*
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
*/

const run = async (conf: Conf) => {
  console.log("rspack value plugin running...");
  console.log(conf);
  await Promise.resolve();
  /*
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
  if (type === meta.system.type.monorepo) {
    await setMonoPathAlias(name);
  }
  */
};

regValue(
  {
    name: value.builder.rspack,
    label: "Rspack",
    plugin: { run },
    disables: [],
    enables: [],
  },
  meta.plugin.option.builder,
);
