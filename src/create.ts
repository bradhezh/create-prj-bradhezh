import { execSync } from "child_process";
import fs from "node:fs";
import axios from "axios";
import Yaml from "yaml";
import { format } from "util";

import { template, cmd, option, meta, NPM, Conf } from "@/conf";

export const createDir = (conf: Conf) => {
  if (
    !(
      [...meta.type.selfCreateds, option.type.monorepo] as Conf["type"][]
    ).includes(conf.type)
  ) {
    fs.mkdirSync(template.src);
    return;
  }

  if (conf.type === option.type.monorepo) {
    for (const type of meta.type.inMonos.filter(
      (e) =>
        conf[e] &&
        !(meta.type.selfCreateds as readonly Conf["type"][]).includes(e),
    )) {
      fs.mkdirSync(`${type}/${template.src}`, { recursive: true });
    }
    if (meta.type.inMonos.filter((e) => conf[e]).length > 1) {
      fs.mkdirSync(`${meta.type.shared}/${template.src}`, { recursive: true });
    }
  }

  if (conf.frontend === option.frontend.react) {
    console.log(template.message.createVite);
    execSync(
      format(
        cmd.createVite,
        conf.npm,
        conf.type !== option.type.monorepo ? "." : option.type.frontend,
      ),
      { stdio: "inherit" },
    );
  } else if (conf.frontend === option.frontend.next) {
    console.log(template.message.createNext);
    execSync(
      format(
        cmd.createNext,
        conf.npm,
        conf.type !== option.type.monorepo ? "." : option.type.frontend,
      ),
      { stdio: "inherit" },
    );
  }
  if (conf.mobile === option.mobile.expo) {
    console.log(template.message.createExpo);
    const dir = conf.type !== option.type.monorepo ? "." : option.type.mobile;
    execSync(format(cmd.createExpo, conf.npm, dir), { stdio: "inherit" });
    fs.rmSync(`${dir}/${template.git}`, {
      recursive: true,
      force: true,
    });
  }
};

export const createPkg = async (conf: Conf) => {
  const pkgs: {
    url: string;
    file: string;
  }[] = [];
  if (
    conf.type !== option.type.monorepo &&
    !(meta.type.selfCreateds as readonly Conf["type"][]).includes(conf.type) &&
    !(meta.type.withMultiplePkgTmplts as readonly Conf["type"][]).includes(
      conf.type,
    )
  ) {
    pkgs.push({
      url: `${template.url}/${template.package[conf.type as keyof typeof template.package]}`,
      file: template.package.name,
    });
  } else {
    for (const type of meta.type.withMultiplePkgTmplts) {
      if (conf[type]) {
        pkgs.push({
          url: `${template.url}/${template.package[conf[type]]}`,
          file:
            conf.type !== option.type.monorepo
              ? template.package.name
              : `${type}/package.json`,
        });
      }
    }
  }
  for (const pkg of pkgs) {
    const response = await axios.get(`${pkg.url}`, { responseType: "text" });
    fs.writeFileSync(pkg.file, response.data);
  }

  if (conf.type !== option.type.monorepo) {
    execSync(format(cmd.pkgSetName, conf.npm, conf.name), { stdio: "ignore" });
    setPkgVer(conf);
    if (conf.type === option.type.lib || conf.type === option.type.cli) {
      setPkgBin(conf);
    }
    return;
  }

  await createPkgMono(conf);
};

const createPkgMono = async (conf: Conf) => {
  const response = await axios.get(
    `${template.url}/${template.package.monorepo}`,
    { responseType: "text" },
  );
  fs.writeFileSync(template.package.name, response.data);
  if (fs.existsSync(meta.type.shared)) {
    const response = await axios.get(
      `${template.url}/${template.package.shared}`,
      { responseType: "text" },
    );
    fs.writeFileSync(
      `${meta.type.shared}/${template.package.name}`,
      response.data,
    );
  }
  execSync(format(cmd.pkgSetName, conf.npm, conf.name), { stdio: "ignore" });
  setPkgVerMono(conf);
  createWorkspace(conf);
};

const setPkgVer = (conf: Conf, cwd?: string) => {
  if (conf.volta) {
    const node = execSync(cmd.nodeV).toString().trim();
    execSync(
      format(
        cmd.pkgSetVoltaNode,
        conf.npm,
        !node.startsWith("v") ? node : node.slice(1),
      ),
      {
        stdio: "ignore",
        cwd,
      },
    );
    const npm = execSync(format(cmd.npmV, conf.npm)).toString().trim();
    execSync(
      format(
        cmd.pkgSetVoltaNpm,
        conf.npm,
        conf.npm,
        !npm.startsWith("v") ? npm : npm.slice(1),
      ),
      {
        stdio: "ignore",
        cwd,
      },
    );
  }
  if (conf.npm === NPM.pnpm) {
    const pnpm = execSync(cmd.pnpmV).toString().trim();
    execSync(
      format(
        cmd.pkgSetPkgMgr,
        NPM.pnpm,
        NPM.pnpm,
        !pnpm.startsWith("v") ? pnpm : pnpm.slice(1),
      ),
      {
        stdio: "ignore",
        cwd,
      },
    );
  }
};

const setPkgVerMono = (conf: Conf) => {
  setPkgVer(conf);
  for (const type of meta.type.inMonos) {
    if (fs.existsSync(type)) {
      setPkgVer(conf, type);
    }
  }
  if (fs.existsSync(meta.type.shared)) {
    setPkgVer(conf, meta.type.shared);
  }
};

const setPkgBin = (conf: Conf) => {
  execSync(
    format(
      cmd.pkgSetBin,
      conf.npm,
      !conf.name.includes("/") ? conf.name : conf.name.split("/").pop(),
    ),
    { stdio: "ignore" },
  );
};

const createWorkspace = (conf: Conf) => {
  const workspace: {
    packages: string[];
    onlyBuiltDependencies: string[];
    nodeLinker?: "hoisted";
  } = {
    packages: [],
    onlyBuiltDependencies: [],
  };

  for (const type of meta.type.inMonos) {
    if (fs.existsSync(type)) {
      workspace.packages.push(type);
    }
  }
  if (fs.existsSync(meta.type.shared)) {
    workspace.packages.push(meta.type.shared);
  }

  if (conf.backend === option.backend.nest) {
    for (const dep of template.onlyBuiltDeps.nest) {
      workspace.onlyBuiltDependencies.push(dep);
    }
  }

  if (
    conf.frontend === option.frontend.next &&
    fs.existsSync(`${option.type.frontend}/${template.pnpmWkspace}`)
  ) {
    fs.renameSync(
      `${option.type.frontend}/${template.pnpmWkspace}`,
      `${option.type.frontend}/${template.pnpmWkspace}${template.bak}`,
    );
    console.log(template.message.nextWkspaceRenamed);
  }
  if (
    conf.mobile === option.mobile.expo &&
    fs.existsSync(`${option.type.mobile}/${template.pnpmWkspace}`)
  ) {
    fs.renameSync(
      `${option.type.mobile}/${template.pnpmWkspace}`,
      `${option.type.mobile}/${template.pnpmWkspace}${template.bak}`,
    );
    console.log(template.message.expoWkspaceRenamed);
    workspace.nodeLinker = "hoisted";
  }

  fs.writeFileSync("pnpm-workspace.yaml", Yaml.stringify(workspace));
};
