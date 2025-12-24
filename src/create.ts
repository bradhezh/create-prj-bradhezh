import { execSync } from "child_process";
import fs from "node:fs";
import axios from "axios";
import Yaml from "yaml";

import { Conf, option, template } from "@/conf";

export const createDir = (conf: Conf) => {
  if (
    conf.type === option.type.node ||
    conf.type === option.type.lib ||
    conf.type === option.type.cli ||
    conf.type === option.type.backend
  ) {
    fs.mkdirSync("src");
    return;
  }

  if (conf.type === option.type.monorepo) {
    if (conf.backend) {
      fs.mkdirSync("backend/src", { recursive: true });
    }
    if (
      (conf.backend && conf.frontend) ||
      (conf.backend && conf.mobile) ||
      (conf.frontend && conf.mobile)
    ) {
      fs.mkdirSync("share/src", { recursive: true });
    }
  }
  if (conf.frontend === option.frontend.react) {
    console.log("create-vite ...");
    execSync(
      `${conf.npm} create vite ${conf.type !== option.type.monorepo ? "." : "frontend"} --template react-ts`,
      { stdio: "inherit" },
    );
  } else if (conf.frontend === option.frontend.next) {
    console.log("create-next-app ...");
    execSync(
      `${conf.npm} create next-app ${conf.type !== option.type.monorepo ? "." : "frontend"} --ts --no-react-compiler --no-src-dir -app --api --eslint --tailwind --skip-install --disable-git`,
      { stdio: "inherit" },
    );
  }
  if (conf.mobile === option.mobile.expo) {
    console.log("create-expo-app ...");
    const dir = conf.type !== option.type.monorepo ? "." : "mobile";
    execSync(`${conf.npm} create expo-app ${dir} --no-install`, {
      stdio: "inherit",
    });
    fs.rmSync(`${dir}/.git`, { recursive: true, force: true });
  }
};

export const createPkg = async (conf: Conf) => {
  let url: string | undefined;
  let file = "package.json";
  if (
    conf.type === option.type.node ||
    conf.type === option.type.lib ||
    conf.type === option.type.cli
  ) {
    url = `${template.url}/${template.package[conf.type]}`;
  }
  if (conf.backend) {
    url = `${template.url}/${template.package[conf.backend]}`;
    if (conf.type === option.type.monorepo) {
      file = "backend/package.json";
    }
  }
  if (url) {
    const response = await axios.get(`${url}`, { responseType: "text" });
    fs.writeFileSync(file, response.data);
  }

  if (conf.type !== option.type.monorepo) {
    execSync(`${conf.npm} pkg set name="${conf.name}"`, { stdio: "ignore" });
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
  fs.writeFileSync("package.json", response.data);
  if (fs.existsSync("shared")) {
    const response = await axios.get(
      `${template.url}/${template.package.share}`,
      {
        responseType: "text",
      },
    );
    fs.writeFileSync("shared/package.json", response.data);
  }
  execSync(`pnpm pkg set name="${conf.name}"`, { stdio: "ignore" });
  setPkgVerMono(conf);
  createWorkspace(conf);
};

const setPkgVer = (conf: Conf, cwd?: string) => {
  if (conf.volta) {
    const node = execSync("node -v").toString().trim();
    execSync(
      `${conf.npm} pkg set "volta.node"="${!node.startsWith("v") ? node : node.slice(1)}"`,
      {
        stdio: "ignore",
        cwd,
      },
    );
    const npm = execSync(`${conf.npm} -v`).toString().trim();
    execSync(
      `${conf.npm} pkg set "volta.${conf.npm}"="${!npm.startsWith("v") ? npm : npm.slice(1)}"`,
      {
        stdio: "ignore",
        cwd,
      },
    );
  }
  if (conf.npm === "pnpm") {
    const pnpm = execSync("pnpm -v").toString().trim();
    execSync(
      `pnpm pkg set packageManager="pnpm@${!pnpm.startsWith("v") ? pnpm : pnpm.slice(1)}"`,
      {
        stdio: "ignore",
        cwd,
      },
    );
  }
};

const setPkgVerMono = (conf: Conf) => {
  setPkgVer(conf);
  if (fs.existsSync("backend")) {
    setPkgVer(conf, "backend");
  }
  if (fs.existsSync("frontend")) {
    setPkgVer(conf, "frontend");
  }
  if (fs.existsSync("mobile")) {
    setPkgVer(conf, "mobile");
  }
  if (fs.existsSync("shared")) {
    setPkgVer(conf, "shared");
  }
};

const setPkgBin = (conf: Conf) => {
  const bin = !conf.name.includes("/") ? conf.name : conf.name.split("/").pop();
  execSync(`${conf.npm} pkg set "bin.${bin}"="dist/index.js"`, {
    stdio: "ignore",
  });
};

const createWorkspace = (conf: Conf) => {
  const workspace: {
    packages: string[];
    onlyBuiltDependencies: string[];
  } = {
    packages: [],
    onlyBuiltDependencies: [],
  };

  if (fs.existsSync("backend")) {
    workspace.packages.push("backend");
  }
  if (fs.existsSync("frontend")) {
    workspace.packages.push("frontend");
  }
  if (fs.existsSync("mobile")) {
    workspace.packages.push("mobile");
  }
  if (fs.existsSync("shared")) {
    workspace.packages.push("shared");
  }
  if (conf.backend === option.backend.nest) {
    workspace.onlyBuiltDependencies.push("@nestjs/core");
  }

  fs.writeFileSync("pnpm-workspace.yaml", Yaml.stringify(workspace));
};
