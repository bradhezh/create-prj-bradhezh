import { execSync, exec as execAsync } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, rm, writeFile, rename, access } from "node:fs/promises";
import axios from "axios";
import Yaml from "yaml";
import { format } from "util";
import p from "@clack/prompts";
import wrapAnsi from "wrap-ansi";

import { template, cmd, option, allSelfCreated, meta, NPM } from "@/conf";
import type {
  Conf,
  Type,
  NonSelfCreatedType,
  WithMultiplePkgTmplt,
  WithSinglePkgTemplt,
  ConfWithMultiplePkgTmpltVal,
  Spinner,
} from "@/conf";

const exec = promisify(execAsync);
let volta: boolean | undefined;

export const create = async (conf: Conf, s: Spinner) => {
  for (const type of conf.type !== option.type.monorepo
    ? [conf.type]
    : (conf.monorepo!.types as unknown as Type[])) {
    if (allSelfCreated(conf, [type])) {
      await createSelf(conf, type, s);
    } else {
      await createType(conf, type as NonSelfCreatedType);
    }
  }
  if (conf.type === option.type.monorepo) {
    await createMono(conf, s);
  }
};

const createSelf = async (conf: Conf, type: Type, s: Spinner) => {
  let created = false;
  const dir = conf.type !== option.type.monorepo ? "." : type;
  if (type === "frontend") {
    if (conf.frontend!.framework === option.optional.frontend.framework.vite) {
      p.log.info(template.message.createVite);
      s.stop();
      execSync(format(cmd.createVite, conf.npm, dir), { stdio: "inherit" });
      s.start(template.message.proceed);
      await setPkgVite(conf, dir);
      created = true;
    } else if (
      conf.frontend!.framework === option.optional.frontend.framework.next
    ) {
      p.log.info(template.message.createNext);
      s.stop();
      execSync(format(cmd.createNext, conf.npm, dir), { stdio: "inherit" });
      s.start(template.message.proceed);
      await setPkgNext(conf, dir);
      created = true;
    }
  } else if (type === "mobile") {
    if (conf.mobile!.framework === option.optional.mobile.framework.expo) {
      p.log.info(template.message.createExpo);
      s.stop();
      execSync(format(cmd.createExpo, conf.npm, dir), { stdio: "inherit" });
      s.start(template.message.proceed);
      await setPkgExpo(conf, dir);
      await rm(`${dir}/${template.git}`, { recursive: true, force: true });
      created = true;
    }
  }
  if (!created) {
    p.log.warn(format(template.message.noSelfCreateCmd, type));
    return;
  }
  await setPkg(conf, type);
  await setSelfCreatedToolChain(conf, type);
};

const createType = async (conf: Conf, type: NonSelfCreatedType) => {
  await mkdir(
    conf.type !== option.type.monorepo
      ? template.src
      : `${type}/${template.src}`,
    { recursive: true },
  );
  await createPkg(conf, type);
  await setPkg(conf, type);
  await createToolChain(conf, type);
};

const createMono = async (conf: Conf, s: Spinner) => {
  if ((conf.monorepo!.types as unknown as Type[]).length > 1) {
    await mkdir(`${meta.type.shared}/${template.src}`, { recursive: true });
    const shared = await axios.get(
      `${template.url}/${template.package.shared}`,
      { responseType: "text" },
    );
    await writeFile(
      `${meta.type.shared}/${template.package.name}`,
      shared.data,
    );
    await setPkgVers(conf, meta.type.shared);
    await createToolChainShared(conf);
  }

  const mono = await axios.get(monoPkgTmplt(conf), { responseType: "text" });
  await writeFile(template.package.name, mono.data);
  await setPkg(conf, option.type.monorepo);
  await createWkspace(conf, s);
};

const createPkg = async (conf: Conf, type: NonSelfCreatedType) => {
  const dir = conf.type !== option.type.monorepo ? "." : type;
  if (!(meta.type.withMultiplePkgTmplts as readonly Type[]).includes(type)) {
    const response = await axios.get(
      `${template.url}/${template.package[type as WithSinglePkgTemplt]}`,
      { responseType: "text" },
    );
    await writeFile(`${dir}/${template.package.name}`, response.data);
    return;
  }
  for (const value of Object.values(
    conf[type as WithMultiplePkgTmplt]!,
  ) as ConfWithMultiplePkgTmpltVal[]) {
    if (value in template.package) {
      const response = await axios.get(
        `${template.url}/${template.package[value]}`,
        { responseType: "text" },
      );
      await writeFile(`${dir}/${template.package.name}`, response.data);
      return;
    }
  }
  throw new Error(
    format(template.message.noTmplt, template.message.type[type]),
  );
};

const setPkg = async (conf: Conf, type: Type) => {
  await setPkgVers(
    conf,
    conf.type !== option.type.monorepo || type === option.type.monorepo
      ? "."
      : type,
  );
  if (conf.type !== option.type.monorepo || type === option.type.monorepo) {
    await exec(format(cmd.setPkgName, conf.npm, conf.name));
  }
  if (type === option.type.lib || type === option.type.cli) {
    await setPkgBin(conf);
  }
};

const createToolChain = async (conf: Conf, type: Type) => {
  await Promise.resolve({ conf, type });
};

const createToolChainShared = async (conf: Conf) => {
  await Promise.resolve({ conf });
};

const setSelfCreatedToolChain = async (conf: Conf, type: Type) => {
  // path aliases
  await Promise.resolve({ conf, type });
};

const monoPkgTmplt = (conf: Conf) => {
  const types = conf.monorepo!.types as unknown as Type[];
  if (!types.includes(option.type.backend)) {
    if (
      types.includes(option.type.frontend) &&
      types.includes(option.type.mobile)
    ) {
      return `${template.url}/${template.package.monoFeMobile}`;
    }
    return `${template.url}/${template.package.monorepo}`;
  }
  if (conf.frontend?.framework === option.optional.frontend.framework.next) {
    if (!types.includes(option.type.mobile)) {
      return `${template.url}/${template.package.monoBeNext}`;
    }
    return `${template.url}/${template.package.monoBeNextMobile}`;
  }
  if (types.includes(option.type.frontend)) {
    if (!types.includes(option.type.mobile)) {
      return `${template.url}/${template.package.monoBeFe}`;
    }
    return `${template.url}/${template.package.monoBeFeMobile}`;
  }
  if (types.includes(option.type.mobile)) {
    return `${template.url}/${template.package.monoBeMobile}`;
  }
  return `${template.url}/${template.package.monorepo}`;
};

const createWkspace = async (conf: Conf, s: Spinner) => {
  const workspace: {
    packages: string[];
    onlyBuiltDependencies: string[];
    nodeLinker?: "hoisted";
  } = { packages: [], onlyBuiltDependencies: [] };

  const types = conf.monorepo!.types as unknown as Type[];
  for (const type of types) {
    workspace.packages.push(type);
  }
  if (types.length > 1) {
    workspace.packages.push(meta.type.shared);
  }

  if (conf.backend?.framework === option.optional.backend.framework.nest) {
    for (const dep of template.onlyBuiltDeps.nest) {
      workspace.onlyBuiltDependencies.push(dep);
    }
  }

  if (
    conf.frontend?.framework === option.optional.frontend.framework.next &&
    (await access(`${option.type.frontend}/${template.pnpmWkspace}`)
      .then(() => true)
      .catch(() => false))
  ) {
    await rename(
      `${option.type.frontend}/${template.pnpmWkspace}`,
      `${option.type.frontend}/${template.pnpmWkspace}${template.bak}`,
    );
    s.stop();
    p.log.warn(
      wrapAnsi(template.message.nextWkspaceRenamed, template.message.noteWidth),
    );
    s.start(template.message.proceed);
  }
  if (
    conf.mobile?.framework === option.optional.mobile.framework.expo &&
    (await access(`${option.type.mobile}/${template.pnpmWkspace}`)
      .then(() => true)
      .catch(() => false))
  ) {
    workspace.nodeLinker = "hoisted";
    await rename(
      `${option.type.mobile}/${template.pnpmWkspace}`,
      `${option.type.mobile}/${template.pnpmWkspace}${template.bak}`,
    );
    s.stop();
    p.log.warn(
      wrapAnsi(template.message.expoWkspaceRenamed, template.message.noteWidth),
    );
    s.start(template.message.proceed);
  }

  await writeFile("pnpm-workspace.yaml", Yaml.stringify(workspace));
};

const setPkgVite = async (conf: Conf, cwd: string) => {
  await exec(
    format(
      cmd.setPkgScripts,
      conf.npm,
      cmd.script.vite.name,
      cmd.script.vite.script,
    ),
    { cwd },
  );
};

const setPkgNext = async (conf: Conf, cwd: string) => {
  await exec(
    format(
      cmd.setPkgDevDeps,
      conf.npm,
      cmd.dep.vercel.name,
      cmd.dep.vercel.version,
    ),
    { cwd },
  );
};

const setPkgExpo = async (conf: Conf, cwd: string) => {
  await exec(
    format(
      cmd.setPkgScripts,
      conf.npm,
      cmd.script.eas.name,
      cmd.script.eas.script,
    ),
    { cwd },
  );
  await exec(
    format(cmd.setPkgDevDeps, conf.npm, cmd.dep.eas.name, cmd.dep.eas.version),
    { cwd },
  );
};

const setPkgVers = async (conf: Conf, cwd: string) => {
  if (volta === undefined) {
    try {
      await exec(cmd.voltaV);
      volta = true;
    } catch {
      volta = false;
    }
  }
  if (volta) {
    const node = (await exec(cmd.nodeV)).stdout.trim();
    await exec(
      format(
        cmd.setPkgVoltaNode,
        conf.npm,
        !node.startsWith("v") ? node : node.slice(1),
      ),
      { cwd },
    );
    const npm = (await exec(format(cmd.npmV, conf.npm))).stdout.trim();
    await exec(
      format(
        cmd.setPkgVoltaNpm,
        conf.npm,
        conf.npm,
        !npm.startsWith("v") ? npm : npm.slice(1),
      ),
      { cwd },
    );
  }

  if (conf.npm === NPM.pnpm) {
    const pnpm = (await exec(cmd.pnpmV)).stdout.trim();
    await exec(
      format(
        cmd.setPkgPkgMgr,
        NPM.pnpm,
        NPM.pnpm,
        !pnpm.startsWith("v") ? pnpm : pnpm.slice(1),
      ),
      { cwd },
    );
  }
};

const setPkgBin = async (conf: Conf) => {
  await exec(
    format(
      cmd.setPkgBin,
      conf.npm,
      !conf.name.includes("/") ? conf.name : conf.name.split("/").pop(),
    ),
  );
};
