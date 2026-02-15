import { log, spinner } from "@clack/prompts";
import { format } from "node:util";

import { regType, meta, NPM, Conf, Plugin, PrimeType } from "@/registry";
import {
  installTmplt,
  setPkgName,
  setPkgVers,
  setPkgScript,
  createWkspace,
} from "@/command";
import { message } from "@/message";

async function run(this: Plugin, conf: Conf) {
  const s = spinner();
  s.start();
  log.info(format(message.pluginStart, this.label));

  const {
    name,
    names,
    beName,
    feName,
    mName,
    defType,
    defName,
    npm,
    shared,
    sharedJs,
  } = parseConf(conf);

  await installTmplt(base, { mono: template.monorepo }, "mono");
  log.info(message.setPkg);
  await setPkgName(name, npm);
  await setPkgVers(npm);
  await monoSetPkgScripts(beName, feName, mName, defType, defName, npm);
  log.info(message.setWkspace);
  await createWkspace(names);
  if (shared) {
    log.info(message.setShared);
    await createShared(sharedJs, npm);
  }

  log.info(format(message.pluginFinish, this.label));
  s.stop();
}

const parseConf = (conf: Conf) => {
  const name = conf.monorepo!.name;
  if (!name) {
    throw new Error();
  }
  const types = conf.monorepo!.types as PrimeType[];
  const names = types.map((e) => conf[e]?.name) as string[];
  if (names.find((e) => !e) || new Set(names).size !== names.length) {
    throw new Error();
  }
  let beName;
  let defName;
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
  const npm = conf.npm;
  const shared = types.length > 1;
  const sharedJs =
    types.filter((e) => conf[e]?.typescript !== meta.plugin.value.none)
      .length <= 1;
  return {
    name,
    names,
    beName,
    feName,
    mName,
    defType,
    defName,
    npm,
    shared,
    sharedJs,
  };
};

const monoSetPkgScripts = async (
  beName: string | undefined,
  feName: string | undefined,
  mName: string | undefined,
  defType: PrimeType,
  defName: string | undefined,
  npm: NPM,
) => {
  await setBuild(beName, feName, defName, mName, npm);
  await setDev(defName, feName, mName, npm);
  await setStart(defName, defType, npm);
};

const setBuild = async (
  beName: string | undefined,
  feName: string | undefined,
  defName: string | undefined,
  mName: string | undefined,
  npm: NPM,
) => {
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

const setDev = async (
  defName: string | undefined,
  feName: string | undefined,
  mName: string | undefined,
  npm: NPM,
) => {
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

const setStart = async (
  defName: string | undefined,
  defType: PrimeType,
  npm: NPM,
) => {
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

const createShared = async (sharedJs: boolean, npm: NPM) => {
  await installTmplt(
    base,
    { shared: sharedJs ? template.sharedJs : template.shared },
    "shared",
    meta.system.type.shared,
    true,
  );
  await setPkgVers(npm, meta.system.type.shared);
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

const template = {
  monorepo: { name: "package.json", path: "/mono/package.json" },
  shared: { name, path: "/shrd/ts/type.tar" },
  sharedJs: { name, path: "/shrd/js/type.tar" },
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
    script: 'pnpm dlx rimraf %s/dist && pnpm dlx cpx "%s/dist/**/*" %s/dist',
  },
  frontend: { suffix: ":fe" },
  mobile: { suffix: ":m" },
} as const;
