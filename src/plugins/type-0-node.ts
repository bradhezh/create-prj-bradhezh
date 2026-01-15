import { exec as execAsync } from "node:child_process";
import { promisify, format } from "node:util";
import { writeFile, rm } from "node:fs/promises";
import path from "node:path";
import axios from "axios";

import { regType, meta, Conf } from "@/registry";
import { setPkgName, setPkgVers } from "@/command";

const exec = promisify(execAsync);

const command = { tar: "tar -xvf node.tar" } as const;

const template = {
  url: "https://raw.githubusercontent.com/bradhezh/prj-template/master/type/node/node.tar",
  name: "node.tar",
} as const;

const run = async (conf: Conf) => {
  const npm = conf.npm;
  const name = conf.node!.name!;
  const cwd = conf.type !== meta.system.type.monorepo ? "." : name;

  const file = path.join(cwd, template.name);
  await writeFile(
    file,
    (await axios.get(template.url, { responseType: "arraybuffer" })).data,
  );
  await exec(format(command.tar), { cwd });
  await rm(file, { force: true });
  await setPkgName(npm, name, cwd);
  await setPkgVers(npm, cwd);
};

regType({
  name: meta.plugin.type.node,
  label: "Node",
  plugin: { run },
  options: [
    {
      name: meta.plugin.option.type.common.name,
      label: "Node app name",
      values: [],
    },
  ],
  disables: [],
  enables: [
    { option: meta.plugin.option.builder },
    /*
    { option: meta.plugin.option.typescript },
    { option: meta.plugin.option.test },
    { option: meta.plugin.option.lint },
    { option: meta.plugin.option.orm },
    */
  ],
});
