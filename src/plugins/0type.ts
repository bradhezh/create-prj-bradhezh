import { exec as execAsync } from "node:child_process";
import { promisify, format } from "node:util";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import axios from "axios";
import Yaml from "yaml";

import { meta, regType, Conf, PlugType } from "@/registry";
import {
  setPkgName,
  setPkgVers,
  setPkgScript,
  setPkgBin,
  setMonoPathAlias,
} from "@/command";

const exec = promisify(execAsync);

const types = [
  {
    name: meta.plugin.type.node,
    label: "Node",
    options: [
      {
        name: meta.plugin.option.type.common.name,
        label: "Node app name",
        values: [],
      },
    ],
  },
  {
    name: meta.plugin.type.cli,
    label: "CLI tool",
    options: [
      {
        name: meta.plugin.option.type.common.name,
        label: "CLI tool name",
        values: [],
      },
    ],
  },
  {
    name: meta.plugin.type.lib,
    label: "Library",
    options: [
      {
        name: meta.plugin.option.type.common.name,
        label: "Library name",
        values: [],
      },
    ],
  },
  {
    name: meta.plugin.type.backend,
    label: "Backend",
    options: [
      {
        name: meta.plugin.option.type.common.name,
        label: "Backend name",
        values: [],
      },
      {
        name: meta.plugin.option.type.backend.framework,
        label: "Framework",
        values: [
          { name: "express", label: "Express" },
          { name: "nest", label: "NestJS" },
        ],
      },
    ],
  },
];

let hasRun = false;

const run = async (conf: Conf) => {
  if (hasRun) {
    return;
  }
  const types0: string[] = [];
  if (conf.type !== meta.system.type.monorepo) {
    types0.push(conf.type);
  } else {
    types0.push(...conf.monorepo!.types);
  }
  for (const type of types0.filter((e0) => types.find((e) => e.name === e0))) {
    const type0 = type as PlugType;
    const cwd =
      conf.type !== meta.system.type.monorepo ? "." : conf[type0]!.name!;
    await installTmplt(conf, type0, cwd);
    if (type0 === "cli" || type0 === "lib") {
      await setPkg(conf, type0, cwd);
    }
    if (
      conf.type === meta.system.type.monorepo &&
      conf.monorepo!.types.length > 1 &&
      type0 === meta.plugin.type.backend
    ) {
      await setBackendWithShared(conf);
    }
  }
  hasRun = true;
};

for (const type of types) {
  regType({ ...type, plugin: { run } });
}

const command = { tar: "tar -xvf %s.tar" } as const;

const template = {
  url: "https://raw.githubusercontent.com/bradhezh/prj-template/master/type",
  name: ".tar",
  backend: "monorepo/backend/backend.tar",
  shared: "monorepo/shared/shared.tar",
} as const;

const installTmplt = async (conf: Conf, type: PlugType, cwd: string) => {
  const name = (conf[type]!.framework as string) ?? type;
  const file = path.join(cwd, `${name}${template.name}`);
  await writeFile(
    file,
    (
      await axios.get(`${template.url}/${name}/${name}${template.name}`, {
        responseType: "arraybuffer",
      })
    ).data,
  );
  await exec(format(command.tar, name), { cwd });
  await rm(file, { force: true });
  await setPkgName(conf, conf[type]!.name!, cwd);
  await setPkgVers(conf, cwd);
};

const script = {
  lib: {
    cleanDts: {
      name: "clean-dts",
      script: '%s dlx del-cli "dist/*.d.ts" "!dist/index.d.ts"',
    },
    devCli: {
      name: "dev:cli",
      script: "CLI=true %s dev",
    },
  },
} as const;

const setPkg = async (conf: Conf, type: PlugType, cwd: string) => {
  await setPkgBin(conf, conf[type]!.name!, cwd);
  if (type === "lib") {
    await setPkgScript(
      conf,
      script.lib.cleanDts.name,
      script.lib.cleanDts.script,
      cwd,
    );
    await setPkgScript(
      conf,
      script.lib.devCli.name,
      script.lib.devCli.script,
      cwd,
    );
  }
};

const setBackendWithShared = async (conf: Conf) => {
  await setShared(conf);

  const file = path.join(
    conf.backend!.name!,
    `${meta.plugin.type.backend}${template.name}`,
  );
  await writeFile(
    file,
    (
      await axios.get(`${template.url}/${template.backend}`, {
        responseType: "arraybuffer",
      })
    ).data,
  );
  await exec(format(command.tar, meta.plugin.type.backend), {
    cwd: conf.backend!.name!,
  });
  await rm(file, { force: true });
  await setMonoPathAlias(conf.backend!.name!);
};

const setShared = async (conf: Conf) => {
  await mkdir(meta.system.type.shared);
  const file = path.join(
    meta.system.type.shared,
    `${meta.system.type.shared}${template.name}`,
  );
  await writeFile(
    file,
    (
      await axios.get(`${template.url}/${template.shared}`, {
        responseType: "arraybuffer",
      })
    ).data,
  );
  await exec(format(command.tar, meta.system.type.shared), {
    cwd: meta.system.type.shared,
  });
  await rm(file, { force: true });
  await setPkgVers(conf, meta.system.type.shared);
  await addShared();
};

const workspace = "pnpm-workspace.yaml" as const;

const addShared = async () => {
  const doc = Yaml.parse(await readFile(workspace, "utf8"));
  doc.packages.push(meta.system.type.shared);
  await writeFile(workspace, Yaml.stringify(doc));
};
