import { execFile } from "node:child_process";
import { promisify, format } from "node:util";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { log, spinner } from "@clack/prompts";

import {
  option,
  value,
  DeployValue,
  RenderValue,
  CLIDeployValue,
  DeployConf,
  DeploySrcValue,
  DkrValue,
  DeploySrcConf,
  GitValue,
  GitSvcValue,
  GitConf,
} from "./const";
import {
  regValue,
  getElem,
  meta,
  NPM,
  Conf,
  Plugin,
  PluginType,
} from "@/registry";
import { installTmplt, defKey, Template } from "@/command";
import { message as msg } from "@/message";

async function run(this: Plugin, conf: Conf) {
  const s = spinner();
  s.start();
  log.info(format(message.pluginStart, this.label));

  const conf0 = await parseConf(conf);
  if (!conf0) {
    return;
  }
  const {
    monorepo,
    npm,
    git,
    gitData,
    pkgDeploy,
    beDeploy,
    beCwd,
    beDeployData,
    beDeploySrc,
    beSrcData,
    beDir,
    feDeploy,
    feDeployData,
    feDeploySrc,
    feSrcData,
    feDir,
    mDeploy,
    mDeployData,
    mDir,
    name,
  } = conf0;

  await install(
    pkgDeploy,
    beDeploy,
    beDeploySrc,
    feDeploy,
    feDeploySrc,
    mDeploy,
    monorepo,
    npm,
  );
  await linkRepo(git, gitData);
  log.info(message.setGha);
  await setGha(
    beDeploy,
    beCwd,
    beDeployData,
    beDeploySrc,
    beSrcData,
    beDir,
    feDeploy,
    feDeployData,
    feDeploySrc,
    feSrcData,
    feDir,
    mDeploy,
    mDeployData,
    mDir,
    name,
  );
  conf[value.cicd.gha] = {};

  log.info(format(message.pluginFinish, this.label));
  s.stop();
}

const parseConf = async (conf: Conf) => {
  if (
    (conf.backend?.deployment === value.deployment.render &&
      conf.frontend?.deployment === value.deployment.render) ||
    (conf.backend?.[option.deploySrc] === value.deploySrc.dkrhub &&
      conf.frontend?.[option.deploySrc] === value.deploySrc.dkrhub)
  ) {
    throw new Error();
  }
  const monorepo = conf.type === meta.plugin.type.monorepo;
  const npm = conf.npm;
  if (npm !== NPM.npm && npm !== NPM.pnpm) {
    throw new Error();
  }
  const git = conf.git as GitValue;
  if (!git) {
    throw new Error();
  }
  const gitData = conf[git] as GitSvcValue;
  if (!gitData) {
    log.warn(message.noGit);
    return;
  }
  if (git !== value.git.github) {
    if (!gitData.repo || !gitData.token) {
      throw new Error();
    }
    // depending on github anyway
    await getElem(
      undefined,
      meta.plugin.option.git,
      value.git.github,
    ).plugin?.run(conf);
    if (!conf[value.git.github]) {
      log.warn(message.noGh);
      return;
    }
  }
  const pkg = parsePkg(conf);
  if (!pkg) {
    return;
  }
  let backend;
  let frontend;
  let mobile;
  if (!pkg.pkgDeploy) {
    backend = parseBe(conf);
    frontend = parseFe(conf);
    mobile = parseM(conf);
    if (!backend || !frontend || !mobile) {
      return;
    }
  }
  let name;
  if (
    backend?.beDeploySrc === value.deploySrc.ghcr ||
    backend?.beDeploySrc === value.deploySrc.dkrhub ||
    frontend?.feDeploySrc === value.deploySrc.ghcr ||
    frontend?.feDeploySrc === value.deploySrc.dkrhub
  ) {
    name = conf[conf.type as PluginType]?.name;
    if (!name) {
      throw new Error();
    }
  }
  return {
    monorepo,
    npm,
    git,
    gitData,
    ...pkg,
    ...(pkg.pkgDeploy ? {} : { ...backend, ...frontend, ...mobile }),
    name,
  };
};

const parsePkg = (conf: Conf) => {
  if (conf.lib?.deployment && conf.cli?.deployment) {
    throw new Error();
  }
  const pkgDeploy = (conf.lib?.deployment ??
    conf.cli?.deployment) as DeployValue;
  if (pkgDeploy && pkgDeploy !== value.deployment.npmjs) {
    throw new Error();
  }
  return { pkgDeploy };
};

const parseBe = (conf: Conf) => {
  const beDeploy = conf.backend?.deployment as DeployValue;
  let beCwd;
  if (beDeploy) {
    beCwd = conf.type !== meta.plugin.type.monorepo ? "." : conf.backend?.name;
    if (!beCwd) {
      throw new Error();
    }
  }
  let beDeployData;
  let beDeploySrc;
  let beSrcData;
  let beDir;
  if (beDeploy === value.deployment.render) {
    beDeployData = conf.backend![value.deployment.render] as RenderValue;
    if (!beDeployData) {
      log.warn(message.noRender);
      return;
    }
    beDeploySrc = conf.backend![option.deploySrc] as DeploySrcValue;
    if (beDeploySrc === value.deploySrc.dkrhub) {
      beSrcData = conf.backend![value.deploySrc.dkrhub] as DkrValue;
      if (!beSrcData) {
        log.warn(message.noDkr);
        return;
      }
      if (!beSrcData.registry || !beSrcData.token) {
        throw new Error();
      }
    } else if (
      beDeploySrc !== value.deploySrc.ghcr &&
      beDeploySrc !== value.deploySrc.repo
    ) {
      throw new Error();
    }
    if (
      beDeploySrc === value.deploySrc.ghcr ||
      beDeploySrc === value.deploySrc.dkrhub
    ) {
      if (!beDeployData.cred) {
        throw new Error();
      }
      if (conf.type === meta.plugin.type.monorepo) {
        beDir = conf.backend?.name;
        if (!beDir) {
          throw new Error();
        }
      }
    }
  } else if (beDeploy) {
    throw new Error();
  }
  return { beDeploy, beCwd, beDeployData, beDeploySrc, beSrcData, beDir };
};

const parseFe = (conf: Conf) => {
  const feDeploy = conf.frontend?.deployment as DeployValue;
  let feDeployData;
  let feDeploySrc;
  let feSrcData;
  let feDir;
  if (feDeploy === value.deployment.render) {
    feDeployData = conf.frontend![value.deployment.render] as RenderValue;
    if (!feDeployData) {
      log.warn(message.noRender);
      return;
    }
    feDeploySrc = conf.frontend![option.deploySrc] as DeploySrcValue;
    if (feDeploySrc === value.deploySrc.dkrhub) {
      feSrcData = conf.frontend![value.deploySrc.dkrhub] as DkrValue;
      if (!feSrcData) {
        log.warn(message.noDkr);
        return;
      }
      if (!feSrcData.registry || !feSrcData.token) {
        throw new Error();
      }
    } else if (
      feDeploySrc !== value.deploySrc.ghcr &&
      feDeploySrc !== value.deploySrc.repo
    ) {
      throw new Error();
    }
    if (
      feDeploySrc === value.deploySrc.ghcr ||
      feDeploySrc === value.deploySrc.dkrhub
    ) {
      if (!feDeployData.cred) {
        throw new Error();
      }
      if (conf.type === meta.plugin.type.monorepo) {
        feDir = conf.frontend?.name;
        if (!feDir) {
          throw new Error();
        }
      }
    }
  } else if (feDeploy === value.deployment.vercel) {
    feDeployData = conf.frontend![value.deployment.vercel] as CLIDeployValue;
    if (!feDeployData) {
      log.warn(message.noVercel);
      return;
    }
    if (!feDeployData.token) {
      throw new Error();
    }
    if (conf.type === meta.plugin.type.monorepo) {
      feDir = conf.frontend?.name;
      if (!feDir) {
        throw new Error();
      }
    }
  } else if (feDeploy) {
    throw new Error();
  }
  return { feDeploy, feDeployData, feDeploySrc, feSrcData, feDir };
};

const parseM = (conf: Conf) => {
  const mDeploy = conf.mobile?.deployment as DeployValue;
  let mDeployData;
  let mDir;
  if (mDeploy === value.deployment.expo) {
    mDeployData = conf.mobile![value.deployment.expo] as CLIDeployValue;
    if (!mDeployData) {
      log.warn(message.noExpo);
      return;
    }
    if (!mDeployData.token) {
      throw new Error();
    }
    if (conf.type === meta.plugin.type.monorepo) {
      mDir = conf.mobile?.name;
      if (!mDir) {
        throw new Error();
      }
    }
  } else if (mDeploy) {
    throw new Error();
  }
  return { mDeploy, mDeployData, mDir };
};

const install = async (
  pkgDeploy: DeployValue,
  beDeploy: DeployValue,
  beDeploySrc: DeploySrcValue,
  feDeploy: DeployValue,
  feDeploySrc: DeploySrcValue,
  mDeploy: DeployValue,
  monorepo: boolean,
  npm: NPM,
) => {
  if (pkgDeploy) {
    const tmplt = pkgTmplt[pkgDeploy] ?? pkgTmplt.default;
    if (!tmplt) {
      throw new Error();
    }
    await installTmplt(base, tmplt, monorepo ? "monorepo" : npm, ".", true);
    return;
  }
  const tmplt = template[beDeploy ?? defKey] ?? template.default;
  if (!tmplt) {
    throw new Error();
  }
  const tmplt0 =
    tmplt[
      (beDeploySrc === value.deploySrc.ghcr ||
      beDeploySrc === value.deploySrc.dkrhub
        ? "docker"
        : beDeploySrc) ?? defKey
    ] ?? tmplt.default;
  if (!tmplt0) {
    throw new Error();
  }
  const tmplt1 = tmplt0[feDeploy ?? defKey] ?? tmplt0.default;
  if (!tmplt1) {
    throw new Error();
  }
  const tmplt2 =
    tmplt1[
      (feDeploySrc === value.deploySrc.ghcr ||
      feDeploySrc === value.deploySrc.dkrhub
        ? "docker"
        : feDeploySrc) ?? defKey
    ] ?? tmplt1.default;
  if (!tmplt2) {
    throw new Error();
  }
  const tmplt3 = tmplt2[mDeploy ?? defKey] ?? tmplt2.default;
  if (!tmplt3) {
    throw new Error();
  }
  await installTmplt(base, tmplt3, monorepo ? "monorepo" : npm, ".", true);
};

const linkRepo = async (git: Git, gitData: GitData) => {
  if (git !== value.git.github) {
    log.info(message.linkRepo);
    log.warn('todo: link to the repo with "repo" and token in git data');
    const { repo, token } = gitData as GitSvc;
    await Promise.resolve({ repo, token });
  }
};

const setGha = async (
  beDeploy: DeployValue,
  beCwd: string | undefined,
  beDeployData: DeployConf,
  beDeploySrc: DeploySrcValue,
  beSrcData: DeploySrcConf,
  beDir: string | undefined,
  feDeploy: DeployValue,
  feDeployData: DeployConf,
  feDeploySrc: DeploySrcValue,
  feSrcData: DeploySrcConf,
  feDir: string | undefined,
  mDeploy: DeployValue,
  mDeployData: DeployConf,
  mDir: string | undefined,
  name: string | undefined,
) => {
  if (beDeploy) {
    await setEnvSecs(beCwd!, testEnv);
  }
  if (beDeploy === value.deployment.render) {
    const { owner, service, token, cred } = beDeployData as Render;
    await exec("gh", ["secret", "set", renderOwnerKey, "--body", owner]);
    await exec("gh", ["secret", "set", renderSvcKey, "--body", service]);
    await exec("gh", ["secret", "set", renderTokenKey, "--body", token]);
    void (
      cred &&
      (await exec("gh", ["secret", "set", renderCredKey, "--body", cred]))
    );
    if (beDeploySrc === value.deploySrc.dkrhub) {
      const { registry, user, token } = beSrcData as Docker;
      await exec("gh", ["secret", "set", dkrRegKey, "--body", registry]);
      await exec("gh", ["secret", "set", dkrUserKey, "--body", user]);
      await exec("gh", ["secret", "set", dkrTokenKey, "--body", token]);
    }
  }
  if (feDeploy === value.deployment.render) {
    const { owner, service, token, cred } = feDeployData as Render;
    await exec("gh", ["secret", "set", renderOwnerKey, "--body", owner]);
    await exec("gh", ["secret", "set", renderSvcKey, "--body", service]);
    await exec("gh", ["secret", "set", renderTokenKey, "--body", token]);
    void (
      cred &&
      (await exec("gh", ["secret", "set", renderCredKey, "--body", cred]))
    );
    if (feDeploySrc === value.deploySrc.dkrhub) {
      const { registry, user, token } = feSrcData as Docker;
      await exec("gh", ["secret", "set", dkrRegKey, "--body", registry]);
      await exec("gh", ["secret", "set", dkrUserKey, "--body", user]);
      await exec("gh", ["secret", "set", dkrTokenKey, "--body", token]);
    }
  } else if (feDeploy === value.deployment.vercel) {
    const { token } = feDeployData as CLIDeploy;
    await exec("gh", ["secret", "set", vercelTokenKey, "--body", token]);
  }
  if (mDeploy === value.deployment.expo) {
    const { token } = mDeployData as CLIDeploy;
    await exec("gh", ["secret", "set", expoTokenKey, "--body", token]);
  }
  void (
    beDir && (await exec("gh", ["variable", "set", beDirKey, "--body", beDir]))
  );
  void (
    feDir && (await exec("gh", ["variable", "set", feDirKey, "--body", feDir]))
  );
  void (
    mDir && (await exec("gh", ["variable", "set", mDirKey, "--body", mDir]))
  );
  void (
    name && (await exec("gh", ["variable", "set", nameKey, "--body", name]))
  );

  await exec("git", ["add", "."]);
  await exec("git", ["commit", "-m", '"github workflow added"']);
  await exec("git", ["push"]);
};

const setEnvSecs = async (cwd: string, env: string) => {
  const lines = (await readFile(join(cwd, env), "utf-8").catch(() => "")).split(
    /\r?\n/,
  );
  for (const line of lines) {
    if (!line || line.startsWith("#")) {
      continue;
    }
    const [name, ...parts] = line.split("=");
    const key = name.trim();
    const value = parts.join("=").trim();
    if (!key || !value) {
      continue;
    }
    await exec("gh", ["secret", "set", key, "--body", value]);
  }
};

const label = "GitHub Actions" as const;

regValue(
  {
    name: value.cicd.gha,
    label,
    skips: [],
    keeps: [],
    requires: [],
    plugin: {
      name: `${meta.plugin.option.cicd}_${value.cicd.gha}`,
      label,
      run,
    },
  },
  meta.plugin.option.cicd,
);

const exec = promisify(execFile);

type Render = NonNullable<RenderValue>;
type CLIDeploy = NonNullable<CLIDeployValue> & { token: string };
type Docker = NonNullable<DkrValue> & { registry: string; token: string };
type Git = NonNullable<GitValue>;
type GitSvc = NonNullable<GitSvcValue> & { repo: string; token: string };
type GitData = NonNullable<GitConf>;

const base =
  "https://raw.githubusercontent.com/bradhezh/prj-template/master/gha" as const;
const name = "gha.tar" as const;

const pkgTmplt: Partial<
  Record<NonNullable<DeployValue> | typeof defKey, Template<"monorepo" | NPM>>
> = {
  npmjs: {
    monorepo: { name, path: "/pkg/npmjs/monorepo/gha.tar" },
    npm: { name, path: "/pkg/npmjs/npm/gha.tar" },
    pnpm: { name, path: "/pkg/npmjs/pnpm/gha.tar" },
  },
} as const;

type DeploySrcKey =
  | NonNullable<
      | Exclude<
          DeploySrcValue,
          typeof value.deploySrc.ghcr | typeof value.deploySrc.dkrhub
        >
      | "docker"
    >
  | typeof defKey;
const template: Partial<
  Record<
    NonNullable<DeployValue> | typeof defKey,
    Partial<
      Record<
        DeploySrcKey,
        Partial<
          Record<
            NonNullable<DeployValue> | typeof defKey,
            Partial<
              Record<
                DeploySrcKey,
                Partial<
                  Record<
                    NonNullable<DeployValue> | typeof defKey,
                    Template<"monorepo" | NPM>
                  >
                >
              >
            >
          >
        >
      >
    >
  >
> = {
  render: {
    docker: {
      vercel: {
        default: {
          expo: { default: { name, path: "/be/rdr/dkr/vcl/expo/gha.tar" } },
          default: { default: { name, path: "/be/rdr/dkr/vcl/m-n/gha.tar" } },
        },
      },
      default: {
        default: {
          expo: { default: { name, path: "/be/rdr/dkr/fe-n/expo/gha.tar" } },
          default: {
            monorepo: { name, path: "/be/rdr/dkr/fe-n/m-n/mono/gha.tar" },
            default: { name, path: "/be/rdr/dkr/fe-n/m-n/def/gha.tar" },
          },
        },
      },
    },
    repo: {
      vercel: {
        default: {
          expo: { default: { name, path: "/be/rdr/repo/vcl/expo/gha.tar" } },
          default: { default: { name, path: "/be/rdr/repo/vcl/m-n/gha.tar" } },
        },
      },
      default: {
        default: {
          expo: { default: { name, path: "/be/rdr/repo/fe-n/expo/gha.tar" } },
          default: {
            npm: { name, path: "/be/rdr/repo/fe-n/m-n/npm/gha.tar" },
            pnpm: { name, path: "/be/rdr/repo/fe-n/m-n/pnpm/gha.tar" },
          },
        },
      },
    },
  },
  default: {
    default: {
      render: {
        docker: {
          expo: { default: { name, path: "/be/no/rdr/dkr/expo/gha.tar" } },
          default: {
            monorepo: { name, path: "/be/no/rdr/dkr/m-n/mono/gha.tar" },
            default: { name, path: "/be/no/rdr/dkr/m-n/def/gha.tar" },
          },
        },
        repo: {
          expo: { default: { name, path: "/be/no/rdr/repo/expo/gha.tar" } },
          default: {
            npm: { name, path: "/be/no/rdr/repo/m-n/npm/gha.tar" },
            pnpm: { name, path: "/be/no/rdr/repo/m-n/pnpm/gha.tar" },
          },
        },
      },
      vercel: {
        default: {
          expo: { default: { name, path: "/be/no/vcl/expo/gha.tar" } },
          default: {
            monorepo: { name, path: "/be/no/vcl/m-n/mono/gha.tar" },
            npm: { name, path: "/be/no/vcl/m-n/npm/gha.tar" },
            pnpm: { name, path: "/be/no/vcl/m-n/pnpm/gha.tar" },
          },
        },
      },
      default: {
        default: {
          expo: {
            monorepo: { name, path: "/be/no/fe-n/expo/mono/gha.tar" },
            npm: { name, path: "/be/no/fe-n/expo/npm/gha.tar" },
            pnpm: { name, path: "/be/no/fe-n/expo/pnpm/gha.tar" },
          },
          default: {
            npm: { name, path: "/be/no/fe-n/m-n/npm/gha.tar" },
            pnpm: { name, path: "/be/no/fe-n/m-n/pnpm/gha.tar" },
          },
        },
      },
    },
  },
} as const;

const renderOwnerKey = "RENDER_OWNER_ID" as const;
const renderSvcKey = "RENDER_SERVICE_ID" as const;
const renderTokenKey = "RENDER_API_KEY" as const;
const renderCredKey = "RENDER_CRED_ID" as const;
const vercelTokenKey = "VERCEL_TOKEN" as const;
const expoTokenKey = "EXPO_TOKEN" as const;
const dkrRegKey = "DOCKER_REGISTRY" as const;
const dkrUserKey = "DOCKER_USERNAME" as const;
const dkrTokenKey = "DOCKER_TOKEN" as const;
const beDirKey = "BACKEND_DIR" as const;
const feDirKey = "FRONTEND_DIR" as const;
const mDirKey = "MOBILE_DIR" as const;
const nameKey = "NAME" as const;
const testEnv = ".env.test" as const;

const message = {
  ...msg,
  noRender:
    "Cannot work as expected because the render plugin has not run successfully.",
  noDkr:
    "Cannot work as expected because the docker plugin has not run successfully.",
  noGit:
    "Cannot work as expected because the plugin for the Git option has not run successfully.",
  noVercel:
    "Cannot work as expected because the vercel plugin has not run successfully.",
  noExpo:
    "Cannot work as expected because the expo plugin has not run successfully.",
  noGh: "Cannot work as expected because the github plugin has not run successfully.",
  linkRepo: "Linking to the repository",
  setGha: "Setting Github Actions",
} as const;
