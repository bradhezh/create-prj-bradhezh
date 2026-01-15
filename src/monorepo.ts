import { mkdir, writeFile } from "node:fs/promises";
import axios from "axios";
import Yaml from "yaml";
import { format } from "node:util";

import { meta, NPM, Conf, PluginType } from "@/registry";
import { setPkgName, setPkgVers, setPkgScript } from "@/command";

const template = {
  url: "https://raw.githubusercontent.com/bradhezh/prj-template/master/type/monorepo/package.json",
  name: "package.json",
} as const;

const run = async (conf: Conf) => {
  const npm = conf.npm;
  const types = conf.monorepo!.types as PluginType[];
  const defType = types[0];
  const defTypeConf = conf[defType];
  const monoName = conf.monorepo!.name;
  const beName = conf.backend?.name ?? meta.plugin.type.backend;
  const feName = conf.frontend?.name ?? meta.plugin.type.frontend;
  const mName = conf.mobile?.name ?? meta.plugin.type.mobile;

  for (const type of types) {
    await mkdir(conf[type]?.name ?? type);
  }
  await writeFile(
    template.name,
    (await axios.get(template.url, { responseType: "text" })).data,
  );
  await setPkgName(npm, monoName);
  await setPkgVers(npm);
  await setPkgScripts(npm, types, defType, defTypeConf, beName, feName, mName);
  await createWkspace(types, conf);
};

export const monorepo = {
  name: meta.system.type.monorepo,
  label: "Monorepo",
  plugin: { run },
  options: [],
  disables: [],
  enables: [],
};

const script = {
  build: {
    name: "build",
    script: "pnpm --filter %s build",
    fullstack:
      "pnpm --filter %s build && pnpm --filter %s build && pnpm copy-dist",
  },
  dev: { name: "dev", script: "pnpm --filter %s dev" },
  start: { name: "start", script: "pnpm --filter %s start" },
  copyDist: {
    name: "copy-dist",
    script: 'pnpm dlx rimraf %s/dist && pnpm dlx cpx "%s/dist/**/*" %s/dist',
  },
  frontend: { suffix: ":fe" },
  mobile: { suffix: ":m" },
} as const;

const setPkgScripts = async (
  npm: NPM,
  types: PluginType[],
  defType: PluginType,
  defTypeConf: Conf[PluginType],
  beName: string,
  feName: string,
  mName: string,
) => {
  let defName, defIsMobile;
  if (types.length === 1) {
    defName = defTypeConf?.name ?? defType;
    if (defType === meta.plugin.type.mobile) {
      defIsMobile = true;
    }
  } else if (types.includes(meta.plugin.type.backend)) {
    defName = beName;
  } else if (types.includes(meta.plugin.type.frontend)) {
    defName = feName;
  }
  await setBuild(npm, types, beName, feName, mName, defName);
  await setDev(npm, types, feName, mName, defName);
  await setStart(npm, defName, defIsMobile);
};

const setBuild = async (
  npm: NPM,
  types: PluginType[],
  beName: string,
  feName: string,
  mName: string,
  defName?: string,
) => {
  if (
    types.includes(meta.plugin.type.backend) &&
    types.includes(meta.plugin.type.frontend)
  ) {
    await setPkgScript(
      npm,
      script.copyDist.name,
      format(script.copyDist.script, beName, feName, beName),
    );
    await setPkgScript(
      npm,
      script.build.name,
      format(script.build.fullstack, beName, feName),
    );
  } else if (defName) {
    await setPkgScript(
      npm,
      script.build.name,
      format(script.build.script, defName),
    );
  }

  if (types.includes(meta.plugin.type.mobile) && defName !== mName) {
    await setPkgScript(
      npm,
      `${script.build.name}${script.mobile.suffix}`,
      format(script.build.script, mName),
    );
  }
};

const setDev = async (
  npm: NPM,
  types: PluginType[],
  feName: string,
  mName: string,
  defName?: string,
) => {
  void (
    defName &&
    (await setPkgScript(
      npm,
      script.dev.name,
      format(script.dev.script, defName),
    ))
  );
  if (types.includes(meta.plugin.type.frontend) && defName !== feName) {
    await setPkgScript(
      npm,
      `${script.dev.name}${script.frontend.suffix}`,
      format(script.dev.script, feName),
    );
  }
  if (types.includes(meta.plugin.type.mobile) && defName !== mName) {
    await setPkgScript(
      npm,
      `${script.dev.name}${script.mobile.suffix}`,
      format(script.dev.script, mName),
    );
  }
};

const setStart = async (npm: NPM, defName?: string, defIsMobile?: boolean) => {
  if (defName && !defIsMobile) {
    await setPkgScript(
      npm,
      script.start.name,
      format(script.start.script, defName),
    );
  }
};

const workspace = "pnpm-workspace.yaml" as const;

const createWkspace = async (types: PluginType[], conf: Conf) => {
  const packages: string[] = [];
  for (const type of types) {
    packages.push(conf[type]?.name ?? type);
  }
  await writeFile(workspace, Yaml.stringify({ packages }));
};
