import { execFile } from "node:child_process";
import { promisify, format } from "node:util";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { log, spinner } from "@clack/prompts";

import {
  valid,
  option,
  value,
  RenderValue,
  CLIDeployValue,
  DkrValue,
  GitSvcValue,
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

  await install(conf0);
  await linkRepo(conf0);
  log.info(message.setGha);
  await setGha(conf0);
  conf[value.cicd.gha] = {};

  log.info(format(message.pluginFinish, this.label));
  s.stop();
}

const parseConf = async (conf: Conf) => {
  const npm = conf.npm;
  if (npm !== NPM.npm && npm !== NPM.pnpm) {
    throw new Error();
  }
  const monorepo = conf.type === meta.plugin.type.monorepo;
  const deploy = parseDeploy(conf);
  if (!deploy) {
    return;
  }
  const git = await parseGit(conf);
  if (!git) {
    return;
  }
  return { npm, monorepo, ...deploy, ...git };
};

const parseDeploy = (conf: Conf) => {
  if (
    (conf.backend?.deployment === value.deployment.render &&
      conf.frontend?.deployment === value.deployment.render) ||
    ((conf.backend?.[option.deploySrc] === value.deploySrc.dkrhub ||
      conf.backend?.[option.deploySrc] === value.deploySrc.ghcr) &&
      (conf.frontend?.[option.deploySrc] === value.deploySrc.dkrhub ||
        conf.frontend?.[option.deploySrc] === value.deploySrc.ghcr))
  ) {
    throw new Error();
  }
  const be = parseDeployBe(conf);
  if (!be) {
    return;
  }
  const fe = parseDeployFe(conf);
  if (!fe) {
    return;
  }
  const m = parseDeployM(conf);
  if (!m) {
    return;
  }
  const pkg = parseDeployPkg(conf);
  if ((be.beDeploy || fe.feDeploy || m.mDeploy) && pkg.pkgDeploy) {
    throw new Error();
  }
  let name;
  if (
    be?.beDeploySrc === value.deploySrc.dkrhub ||
    be?.beDeploySrc === value.deploySrc.ghcr ||
    fe?.feDeploySrc === value.deploySrc.dkrhub ||
    fe?.feDeploySrc === value.deploySrc.ghcr
  ) {
    name = conf[conf.type as PluginType]?.name;
    if (!name) {
      throw new Error();
    }
  }
  return { ...be, ...fe, ...m, ...pkg, name };
};

const parseDeployBe = (conf: Conf) => {
  const beDeploy = conf.backend?.deployment as Deploy;
  let beCwd;
  if (valid(beDeploy)) {
    beCwd = conf.type !== meta.plugin.type.monorepo ? "." : conf.backend?.name;
    if (!beCwd) {
      throw new Error();
    }
  }
  let beDeployData, beDeploySrc, beSrcData, beDir;
  if (beDeploy === value.deployment.render) {
    beDeployData = conf.backend![value.deployment.render] as RenderValue;
    if (!beDeployData) {
      log.warn(message.noRender);
      return;
    }
    beDeploySrc = conf.backend![option.deploySrc] as DeploySrc;
    if (
      beDeploySrc === value.deploySrc.dkrhub ||
      beDeploySrc === value.deploySrc.ghcr
    ) {
      beSrcData = conf.backend![beDeploySrc] as DkrValue;
      if (!beSrcData) {
        log.warn(message.noDkr);
        return;
      }
      if (
        beDeploySrc === value.deploySrc.dkrhub &&
        (!beSrcData.token || !beSrcData.registry)
      ) {
        throw new Error();
      }
      if (!beDeployData.cred) {
        throw new Error();
      }
      if (conf.type === meta.plugin.type.monorepo) {
        beDir = conf.backend?.name;
        if (!beDir) {
          throw new Error();
        }
      }
    } else if (beDeploySrc === value.deploySrc.repo) {
      void 0;
    } else {
      throw new Error();
    }
  } else if (valid(beDeploy)) {
    throw new Error();
  }
  return { beDeploy, beCwd, beDeployData, beDeploySrc, beSrcData, beDir };
};

const parseDeployFe = (conf: Conf) => {
  const feDeploy = conf.frontend?.deployment as Deploy;
  let feDeployData, feDeploySrc, feSrcData, feDir;
  if (feDeploy === value.deployment.render) {
    feDeployData = conf.frontend![value.deployment.render] as RenderValue;
    if (!feDeployData) {
      log.warn(message.noRender);
      return;
    }
    feDeploySrc = conf.frontend![option.deploySrc] as DeploySrc;
    if (
      feDeploySrc === value.deploySrc.dkrhub ||
      feDeploySrc === value.deploySrc.ghcr
    ) {
      feSrcData = conf.frontend![feDeploySrc] as DkrValue;
      if (!feSrcData) {
        log.warn(message.noDkr);
        return;
      }
      if (
        feDeploySrc === value.deploySrc.dkrhub &&
        (!feSrcData.token || !feSrcData.registry)
      ) {
        throw new Error();
      }
      if (!feDeployData.cred) {
        throw new Error();
      }
      if (conf.type === meta.plugin.type.monorepo) {
        feDir = conf.frontend?.name;
        if (!feDir) {
          throw new Error();
        }
      }
    } else if (feDeploySrc === value.deploySrc.repo) {
      void 0;
    } else {
      throw new Error();
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
  } else if (valid(feDeploy)) {
    throw new Error();
  }
  return { feDeploy, feDeployData, feDeploySrc, feSrcData, feDir };
};

const parseDeployM = (conf: Conf) => {
  const mDeploy = conf.mobile?.deployment as Deploy;
  let mDeployData, mDir;
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
  } else if (valid(mDeploy)) {
    throw new Error();
  }
  return { mDeploy, mDeployData, mDir };
};

const parseDeployPkg = (conf: Conf) => {
  if (valid(conf.lib?.deployment) && valid(conf.cli?.deployment)) {
    throw new Error();
  }
  const pkgDeploy = (
    valid(conf.lib?.deployment) ? conf.lib!.deployment : conf.cli?.deployment
  ) as Deploy;
  let pkgDir;
  if (pkgDeploy === value.deployment.npmjs) {
    if (conf.type === meta.plugin.type.monorepo) {
      pkgDir = valid(conf.lib?.deployment) ? conf.lib!.name : conf.cli?.name;
      if (!pkgDir) {
        throw new Error();
      }
    }
  } else if (valid(pkgDeploy)) {
    throw new Error();
  }
  return { pkgDeploy, pkgDir };
};

const parseGit = async (conf: Conf) => {
  const git = conf.git;
  if (!valid(git)) {
    throw new Error();
  }
  const gitSvc = conf[git!] as GitSvcValue;
  if (!gitSvc) {
    log.warn(message.noGit);
    return;
  }
  if (git !== value.git.github) {
    if (!gitSvc.repo || !gitSvc.token) {
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
  return { git: git!, gitSvc };
};

type InstallData = {
  pkgDeploy: Deploy;
  beDeploy: Deploy;
  beDeploySrc: DeploySrc;
  feDeploy: Deploy;
  feDeploySrc: DeploySrc;
  mDeploy: Deploy;
  monorepo: boolean;
  npm: NPM;
};

const install = async ({
  pkgDeploy,
  beDeploy,
  beDeploySrc,
  feDeploy,
  feDeploySrc,
  mDeploy,
  monorepo,
  npm,
}: InstallData) => {
  if (pkgDeploy) {
    const tmplt = pkgTmplt[pkgDeploy] ?? pkgTmplt.def;
    if (!tmplt) {
      throw new Error();
    }
    await installTmplt(base, tmplt, monorepo ? "mono" : npm, ".", true);
    return;
  }
  const tmplt = template[beDeploy ?? defKey] ?? template.def;
  if (!tmplt) {
    throw new Error();
  }
  const tmplt0 =
    tmplt[
      (beDeploySrc === value.deploySrc.dkrhub ||
      beDeploySrc === value.deploySrc.ghcr
        ? "docker"
        : beDeploySrc) ?? defKey
    ] ?? tmplt.def;
  if (!tmplt0) {
    throw new Error();
  }
  const tmplt1 = tmplt0[feDeploy ?? defKey] ?? tmplt0.def;
  if (!tmplt1) {
    throw new Error();
  }
  const tmplt2 =
    tmplt1[
      (feDeploySrc === value.deploySrc.dkrhub ||
      feDeploySrc === value.deploySrc.ghcr
        ? "docker"
        : feDeploySrc) ?? defKey
    ] ?? tmplt1.def;
  if (!tmplt2) {
    throw new Error();
  }
  const tmplt3 = tmplt2[mDeploy ?? defKey] ?? tmplt2.def;
  if (!tmplt3) {
    throw new Error();
  }
  await installTmplt(base, tmplt3, monorepo ? "mono" : npm, ".", true);
};

type RepoData = { git: string; gitSvc: GitSvc };

const linkRepo = async ({ git, gitSvc }: RepoData) => {
  if (git !== value.git.github) {
    log.info(message.linkRepo);
    log.warn(
      'todo: link to the repo with "repo" and token from the git service',
    );
    const { repo, token } = gitSvc;
    await Promise.resolve([repo!, token!]);
  }
};

type GhaData = {
  beDeploy: Deploy;
  beCwd?: string;
  beDeployData: DeployData;
  beDeploySrc: DeploySrc;
  beSrcData: SrcData;
  beDir?: string;
  feDeploy: Deploy;
  feDeployData: DeployData;
  feDeploySrc: DeploySrc;
  feSrcData: SrcData;
  feDir?: string;
  mDeploy: Deploy;
  mDeployData: DeployData;
  mDir?: string;
  pkgDeploy: Deploy;
  pkgDir?: string;
  name?: string;
};

const setGha = async (data: GhaData) => {
  await setGhaBe(data);
  await setGhaFe(data);
  await setGhaM(data);
  await setGhaPkg(data);
  const { name } = data;
  void (
    name && (await exec("gh", ["variable", "set", nameKey, "--body", name]))
  );
  await setEnvSecs(data);
  await exec("git", ["add", "."]);
  await exec("git", ["commit", "-m", '"github workflow added"']);
  await exec("git", ["push"]);
};

const setGhaBe = async ({
  beDeploy,
  beDeployData,
  beDeploySrc,
  beSrcData,
  beDir,
}: GhaData) => {
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
      await exec("gh", ["secret", "set", dkrRegKey, "--body", registry!]);
      await exec("gh", ["secret", "set", dkrUserKey, "--body", user]);
      await exec("gh", ["secret", "set", dkrTokenKey, "--body", token!]);
    } else if (
      beDeploySrc === value.deploySrc.ghcr ||
      beDeploySrc === value.deploySrc.repo
    ) {
      void 0;
    } else {
      throw new Error();
    }
  } else if (valid(beDeploy)) {
    throw new Error();
  }
  void (
    beDir && (await exec("gh", ["variable", "set", beDirKey, "--body", beDir]))
  );
};

const setGhaFe = async ({
  feDeploy,
  feDeployData,
  feDeploySrc,
  feSrcData,
  feDir,
}: GhaData) => {
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
      await exec("gh", ["secret", "set", dkrRegKey, "--body", registry!]);
      await exec("gh", ["secret", "set", dkrUserKey, "--body", user]);
      await exec("gh", ["secret", "set", dkrTokenKey, "--body", token!]);
    } else if (
      feDeploySrc === value.deploySrc.ghcr ||
      feDeploySrc === value.deploySrc.repo
    ) {
      void 0;
    } else {
      throw new Error();
    }
  } else if (feDeploy === value.deployment.vercel) {
    const { token } = feDeployData as CLIDeploy;
    await exec("gh", ["secret", "set", vercelTokenKey, "--body", token!]);
  } else if (valid(feDeploy)) {
    throw new Error();
  }
  void (
    feDir && (await exec("gh", ["variable", "set", feDirKey, "--body", feDir]))
  );
};

const setGhaM = async ({ mDeploy, mDeployData, mDir }: GhaData) => {
  if (mDeploy === value.deployment.expo) {
    const { token } = mDeployData as CLIDeploy;
    await exec("gh", ["secret", "set", expoTokenKey, "--body", token!]);
  } else if (valid(mDeploy)) {
    throw new Error();
  }
  void (
    mDir && (await exec("gh", ["variable", "set", mDirKey, "--body", mDir]))
  );
};

const setGhaPkg = async ({ pkgDeploy, pkgDir }: GhaData) => {
  if (pkgDeploy === value.deployment.npmjs) {
    void 0;
  } else if (valid(pkgDeploy)) {
    throw new Error();
  }
  void (
    pkgDir &&
    (await exec("gh", ["variable", "set", pkgDirKey, "--body", pkgDir]))
  );
};

const setEnvSecs = async ({ beCwd }: GhaData) => {
  if (beCwd) {
    const lines = (
      await readFile(join(beCwd, env), "utf-8").catch(() => "")
    ).split(/\r?\n/);
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
type CLIDeploy = NonNullable<CLIDeployValue>;
type DeployData = RenderValue | CLIDeployValue;
type Docker = NonNullable<DkrValue>;
type SrcData = DkrValue;
type GitSvc = NonNullable<GitSvcValue>;

const base =
  "https://raw.githubusercontent.com/bradhezh/prj-template/master/gha" as const;
const name = "gha.tar" as const;

type Deploy = keyof typeof value.deployment | undefined;
type DeployKey = NonNullable<Deploy> | typeof defKey;
type DeploySrc = keyof typeof value.deploySrc | undefined;
type SrcKey =
  | Exclude<
      NonNullable<DeploySrc>,
      typeof value.deploySrc.dkrhub | typeof value.deploySrc.ghcr
    >
  | "docker"
  | typeof defKey;
const template: Partial<
  Record<
    DeployKey,
    Partial<
      Record<
        SrcKey,
        Partial<
          Record<
            DeployKey,
            Partial<
              Record<SrcKey, Partial<Record<DeployKey, Template<"mono" | NPM>>>>
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
        def: {
          expo: { def: { name, path: "/be/rdr/dkr/vcl/expo/gha.tar" } },
          def: { def: { name, path: "/be/rdr/dkr/vcl/m-n/gha.tar" } },
        },
      },
      def: {
        def: {
          expo: { def: { name, path: "/be/rdr/dkr/fe-n/expo/gha.tar" } },
          def: {
            mono: { name, path: "/be/rdr/dkr/fe-n/m-n/mono/gha.tar" },
            def: { name, path: "/be/rdr/dkr/fe-n/m-n/def/gha.tar" },
          },
        },
      },
    },
    repo: {
      vercel: {
        def: {
          expo: { def: { name, path: "/be/rdr/repo/vcl/expo/gha.tar" } },
          def: { def: { name, path: "/be/rdr/repo/vcl/m-n/gha.tar" } },
        },
      },
      def: {
        def: {
          expo: { def: { name, path: "/be/rdr/repo/fe-n/expo/gha.tar" } },
          def: {
            npm: { name, path: "/be/rdr/repo/fe-n/m-n/npm/gha.tar" },
            pnpm: { name, path: "/be/rdr/repo/fe-n/m-n/pnpm/gha.tar" },
          },
        },
      },
    },
  },
  def: {
    def: {
      render: {
        docker: {
          expo: { def: { name, path: "/be/no/rdr/dkr/expo/gha.tar" } },
          def: {
            mono: { name, path: "/be/no/rdr/dkr/m-n/mono/gha.tar" },
            def: { name, path: "/be/no/rdr/dkr/m-n/def/gha.tar" },
          },
        },
        repo: {
          expo: { def: { name, path: "/be/no/rdr/repo/expo/gha.tar" } },
          def: {
            npm: { name, path: "/be/no/rdr/repo/m-n/npm/gha.tar" },
            pnpm: { name, path: "/be/no/rdr/repo/m-n/pnpm/gha.tar" },
          },
        },
      },
      vercel: {
        def: {
          expo: { def: { name, path: "/be/no/vcl/expo/gha.tar" } },
          def: {
            mono: { name, path: "/be/no/vcl/m-n/mono/gha.tar" },
            npm: { name, path: "/be/no/vcl/m-n/npm/gha.tar" },
            pnpm: { name, path: "/be/no/vcl/m-n/pnpm/gha.tar" },
          },
        },
      },
      def: {
        def: {
          expo: {
            mono: { name, path: "/be/no/fe-n/expo/mono/gha.tar" },
            npm: { name, path: "/be/no/fe-n/expo/npm/gha.tar" },
            pnpm: { name, path: "/be/no/fe-n/expo/pnpm/gha.tar" },
          },
          def: {
            npm: { name, path: "/be/no/fe-n/m-n/npm/gha.tar" },
            pnpm: { name, path: "/be/no/fe-n/m-n/pnpm/gha.tar" },
          },
        },
      },
    },
  },
} as const;

const pkgTmplt: Partial<Record<DeployKey, Template<"mono" | NPM>>> = {
  npmjs: {
    mono: { name, path: "/pkg/npm/mono/gha.tar" },
    npm: { name, path: "/pkg/npm/npm/gha.tar" },
    pnpm: { name, path: "/pkg/npm/pnpm/gha.tar" },
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
const pkgDirKey = "PKG_DIR" as const;
const nameKey = "NAME" as const;
const env = ".env.test" as const;

const message = {
  ...msg,
  noRender:
    "Cannot work as expected because the Render plugin has not run successfully.",
  noDkr:
    "Cannot work as expected because the docker plugin has not run successfully.",
  noGit:
    "Cannot work as expected because the plugin for the Git option has not run successfully.",
  noVercel:
    "Cannot work as expected because the Vercel plugin has not run successfully.",
  noExpo:
    "Cannot work as expected because the Expo plugin has not run successfully.",
  noGh: "Cannot work as expected because the GitHub plugin has not run successfully.",
  linkRepo: "Linking to the repository",
  setGha: "Setting Github Actions",
} as const;
