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

  const npm = conf.npm;
  const types = conf.monorepo!.types as PrimeType[];
  const defType = types[0];
  const defTypeName = conf[defType]?.name ?? defType;
  const monoName = conf.monorepo!.name;
  const beName = conf.backend?.name ?? meta.plugin.type.backend;
  const feName = conf.frontend?.name ?? meta.plugin.type.frontend;
  const mName = conf.mobile?.name ?? meta.plugin.type.mobile;
  const packages = types.map((e) => conf[e]?.name ?? e);
  const jsTypes = types.filter(
    (e) => conf[e]?.typescript === meta.plugin.value.none,
  );

  await installTmplt(base, { monorepo: template.monorepo }, "monorepo");

  log.info(message.setPkg);
  await setPkgName(npm, monoName);
  await setPkgVers(npm);
  await monoSetPkgScripts(
    npm,
    types,
    defType,
    defTypeName,
    beName,
    feName,
    mName,
  );

  log.info(message.setWkspace);
  await createWkspace(packages);

  if (types.length > 1) {
    log.info(message.setShared);
    await createShared(npm, types, jsTypes);
  }

  log.info(format(message.pluginFinish, this.label));
  s.stop();
}

const monoSetPkgScripts = async (
  npm: NPM,
  types: PrimeType[],
  defType: PrimeType,
  defTypeName: string,
  beName: string,
  feName: string,
  mName: string,
) => {
  let defName, noStart;
  if (types.includes(meta.plugin.type.backend)) {
    defName = beName;
  } else if (types.includes(meta.plugin.type.frontend)) {
    defName = feName;
  } else if (types.length === 1) {
    defName = defTypeName;
    if (
      defType === meta.plugin.type.mobile ||
      defType === meta.plugin.type.cli ||
      defType === meta.plugin.type.lib
    ) {
      noStart = true;
    }
  }
  await setBuild(npm, types, beName, feName, mName, defName);
  await setDev(npm, types, feName, mName, defName);
  await setStart(npm, defName, noStart);
};

const setBuild = async (
  npm: NPM,
  types: PrimeType[],
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
  } else if (defName && defName !== mName) {
    await setPkgScript(
      npm,
      script.build.name,
      format(script.build.script, defName),
    );
  }
};

const setDev = async (
  npm: NPM,
  types: PrimeType[],
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
  if (types.includes(meta.plugin.type.frontend) && feName !== defName) {
    await setPkgScript(
      npm,
      `${script.dev.name}${script.frontend.suffix}`,
      format(script.dev.script, feName),
    );
  }
  if (types.includes(meta.plugin.type.mobile) && mName !== defName) {
    await setPkgScript(
      npm,
      `${script.dev.name}${script.mobile.suffix}`,
      format(script.dev.script, mName),
    );
  }
};

const setStart = async (npm: NPM, defName?: string, noStart?: boolean) => {
  if (defName && !noStart) {
    await setPkgScript(
      npm,
      script.start.name,
      format(script.start.script, defName),
    );
  }
};

const createShared = async (
  npm: NPM,
  types: PrimeType[],
  jsTypes: PrimeType[],
) => {
  if (types.filter((e) => !jsTypes.includes(e)).length > 1) {
    await installTmplt(
      base,
      { shared: template.shared },
      "shared",
      meta.system.type.shared,
      true,
    );
  } else {
    await installTmplt(
      base,
      { jsShared: template.jsShared },
      "jsShared",
      meta.system.type.shared,
      true,
    );
  }
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
  "https://raw.githubusercontent.com/bradhezh/prj-template/master/type/monorepo" as const;

const template = {
  monorepo: { name: "package.json", path: "/package.json" },
  shared: { name: "shared.tar", path: "/shared/shared.tar" },
  jsShared: { name: "shared.tar", path: "/shared/js/shared.tar" },
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
