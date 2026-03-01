import { log, spinner } from "@clack/prompts";
import { format } from "node:util";

import { regType, meta, NPM, Conf, Plugin, PrimeType } from "@/registry";
import {
  installTmplt,
  setPkgName,
  setPkgVers,
  setPkgScript,
  createWkspace,
  defKey,
} from "@/command";
import { message } from "@/message";

async function run(this: Plugin, conf: Conf) {
  const s = spinner();
  s.start();
  log.info(format(message.pluginStart, this.label));

  const conf0 = parseConf(conf);

  await install();
  log.info(message.setPkg);
  await setPkg(conf0);
  log.info(message.setWkspace);
  await setWkspace(conf0);

  log.info(format(message.pluginFinish, this.label));
  s.stop();
}

const parseConf = (conf: Conf) => {
  const npm = conf.npm;
  if (npm !== NPM.npm && npm !== NPM.pnpm) {
    throw new Error();
  }
  const name = conf.monorepo!.name;
  if (!name) {
    throw new Error();
  }
  const type = parseType(conf);
  return { npm, name, ...type };
};

const parseType = (conf: Conf) => {
  const types = conf.monorepo!.types as PrimeType[];
  const names = types.map((e) => {
    if (!conf[e]?.name) {
      throw new Error();
    }
    return conf[e].name;
  });
  if (new Set(names).size !== names.length) {
    throw new Error();
  }
  let beName, defName;
  if (types.includes(meta.plugin.type.backend)) {
    beName = conf.backend?.name;
    if (!beName) {
      throw new Error();
    }
    defName = beName;
  }
  let feName;
  if (types.includes(meta.plugin.type.frontend)) {
    feName = conf.frontend?.name;
    if (!feName) {
      throw new Error();
    }
    void (defName || (defName = feName));
  }
  let mName;
  if (types.includes(meta.plugin.type.mobile)) {
    mName = conf.mobile?.name;
    if (!mName) {
      throw new Error();
    }
  }
  const defType = types[0];
  if (!defType) {
    throw new Error();
  }
  if (!defName && types.length === 1) {
    defName = conf[defType]?.name;
    if (!defName) {
      throw new Error();
    }
  }
  const shared = types.length > 1;
  const sharedJs =
    types.filter((e) => conf[e]?.typescript !== meta.plugin.value.none)
      .length <= 1;
  return { names, beName, feName, mName, defName, defType, shared, sharedJs };
};

const install = async () => {
  await installTmplt(base, { template }, "template");
};

type PkgData = {
  name: string;
  beName?: string;
  feName?: string;
  mName?: string;
  defName?: string;
  defType: PrimeType;
  npm: NPM;
};

const setPkg = async (data: PkgData) => {
  const { name, npm } = data;
  await setPkgName(name, npm);
  await setPkgVers(npm);
  await setBuildScripts(data);
  await setDevScripts(data);
  await setStartScripts(data);
};

const setBuildScripts = async ({
  beName,
  feName,
  mName,
  defName,
  npm,
}: PkgData) => {
  if (beName && feName) {
    await setPkgScript(
      script.copyDist.name,
      format(script.copyDist.script, beName, feName, beName),
      npm,
    );
    await setPkgScript(
      script.build.name,
      format(script.build.fullstack, beName, feName),
      npm,
    );
  } else if (defName && defName !== mName) {
    await setPkgScript(
      script.build.name,
      format(script.build.script, defName),
      npm,
    );
  }
};

const setDevScripts = async ({ feName, mName, defName, npm }: PkgData) => {
  void (
    defName &&
    (await setPkgScript(
      script.dev.name,
      format(script.dev.script, defName),
      npm,
    ))
  );
  if (feName && feName !== defName) {
    await setPkgScript(
      `${script.dev.name}${script.frontend.suffix}`,
      format(script.dev.script, feName),
      npm,
    );
  }
  if (mName && mName !== defName) {
    await setPkgScript(
      `${script.dev.name}${script.mobile.suffix}`,
      format(script.dev.script, mName),
      npm,
    );
  }
};

const setStartScripts = async ({ defName, defType, npm }: PkgData) => {
  if (
    defName &&
    defType !== meta.plugin.type.lib &&
    defType !== meta.plugin.type.cli &&
    defType !== meta.plugin.type.mobile
  ) {
    await setPkgScript(
      script.start.name,
      format(script.start.script, defName),
      npm,
    );
  }
};

type WkspaceData = {
  names: string[];
  shared: boolean;
  sharedJs: boolean;
  npm: NPM;
};

const setWkspace = async ({ names, shared, sharedJs, npm }: WkspaceData) => {
  await createWkspace(names);
  if (shared) {
    log.info(message.setShared);
    await installTmplt(
      base,
      sharedTmplt,
      sharedJs ? "js" : defKey,
      meta.system.type.shared,
      true,
    );
    await setPkgVers(npm, meta.system.type.shared);
  }
};

const label = "Monorepo" as const;

regType({
  name: meta.plugin.type.monorepo,
  label,
  skips: [],
  keeps: [],
  requires: [],
  plugin: { name: meta.plugin.type.monorepo, label, run },
  options: [],
});

const base =
  "https://raw.githubusercontent.com/bradhezh/prj-template/master/type" as const;
const name = "type.tar" as const;

const template = { name: "package.json", path: "/mono/package.json" } as const;

const sharedTmplt = {
  js: { name, path: "/shrd/js/type.tar" },
  def: { name, path: "/shrd/ts/type.tar" },
} as const;

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
    script: "pnpm dlx shx rm -rf %s/dist && pnpm dlx shx cp -r %s/dist %s/dist",
  },
  frontend: { suffix: ":fe" },
  mobile: { suffix: ":m" },
} as const;
