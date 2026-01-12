import { mkdir, writeFile } from "node:fs/promises";
import axios from "axios";
import Yaml from "yaml";
import { format } from "node:util";

import { meta, Conf, PlugType } from "@/registry";
import { setPkgName, setPkgVers, setPkgScript } from "@/command";

const template =
  "https://raw.githubusercontent.com/bradhezh/prj-template/master/package/package.json" as const;
const pkg = "package.json" as const;
const workspace = "pnpm-workspace.yaml" as const;

const run = async (conf: Conf) => {
  for (const type of conf.monorepo!.types) {
    await mkdir(conf[type as PlugType]?.name ?? type);
  }
  const data = (await axios.get(template, { responseType: "text" })).data;
  if (conf.monorepo!.types.length > 1) {
    const shared = meta.system.type.shared;
    await mkdir(shared);
    await writeFile(`${shared}/${pkg}`, data);
    await setPkgName(conf, shared, shared);
    await setPkgVers(conf, shared);
  }
  await writeFile(pkg, data);
  await setPkgName(conf, conf.monorepo!.name);
  await setPkgVers(conf);
  await setPkgScripts(conf);
  await createWkspace(conf);
};

export const monorepo = {
  name: meta.system.type.monorepo,
  label: "Monorepo",
  plugin: { run },
  options: [],
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

const setPkgScripts = async (conf: Conf) => {
  const beName = conf.backend?.name ?? meta.plugin.type.backend;
  const feName = conf.frontend?.name ?? meta.plugin.type.frontend;
  const mName = conf.mobile?.name ?? meta.plugin.type.mobile;
  let defName, defIsMobile;
  if (conf.monorepo!.types.length === 1) {
    defName =
      conf[conf.monorepo!.types[0] as PlugType]?.name ??
      conf.monorepo!.types[0];
    if (conf.monorepo!.types[0] === meta.plugin.type.mobile) {
      defIsMobile = true;
    }
  } else if (conf.monorepo!.types.includes(meta.plugin.type.backend)) {
    defName = beName;
  } else if (conf.monorepo!.types.includes(meta.plugin.type.frontend)) {
    defName = feName;
  }
  await setBuild(conf, beName, feName, mName, defName);
  await setDev(conf, feName, mName, defName);
  await setStart(conf, defName, defIsMobile);
};

const setBuild = async (
  conf: Conf,
  beName: string,
  feName: string,
  mName: string,
  defName?: string,
) => {
  if (
    conf.monorepo!.types.includes(meta.plugin.type.backend) &&
    conf.monorepo!.types.includes(meta.plugin.type.frontend)
  ) {
    await setPkgScript(
      conf,
      script.copyDist.name,
      format(script.copyDist.script, beName, feName, beName),
    );
    await setPkgScript(
      conf,
      script.build.name,
      format(script.build.fullstack, beName, feName),
    );
  } else if (defName) {
    await setPkgScript(
      conf,
      script.build.name,
      format(script.build.script, defName),
    );
  }

  if (
    conf.monorepo!.types.includes(meta.plugin.type.mobile) &&
    defName !== mName
  ) {
    await setPkgScript(
      conf,
      `${script.build.name}${script.mobile.suffix}`,
      format(script.build.script, mName),
    );
  }
};

const setDev = async (
  conf: Conf,
  feName: string,
  mName: string,
  defName?: string,
) => {
  void (
    defName &&
    (await setPkgScript(
      conf,
      script.dev.name,
      format(script.dev.script, defName),
    ))
  );
  if (
    conf.monorepo!.types.includes(meta.plugin.type.frontend) &&
    defName !== feName
  ) {
    await setPkgScript(
      conf,
      `${script.dev.name}${script.frontend.suffix}`,
      format(script.dev.script, feName),
    );
  }
  if (
    conf.monorepo!.types.includes(meta.plugin.type.mobile) &&
    defName !== mName
  ) {
    await setPkgScript(
      conf,
      `${script.dev.name}${script.mobile.suffix}`,
      format(script.dev.script, mName),
    );
  }
};

const setStart = async (
  conf: Conf,
  defName?: string,
  defIsMobile?: boolean,
) => {
  if (defName && !defIsMobile) {
    await setPkgScript(
      conf,
      script.start.name,
      format(script.start.script, defName),
    );
  }
};

const createWkspace = async (conf: Conf) => {
  const packages: string[] = [];
  for (const type of conf.monorepo!.types) {
    packages.push(conf[type as PlugType]?.name ?? type);
  }
  if (conf.monorepo!.types.length > 1) {
    packages.push(meta.system.type.shared);
  }
  await writeFile(workspace, Yaml.stringify({ packages }));
};
