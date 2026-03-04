import { execSync, exec as execAsync } from "node:child_process";
import { promisify, format } from "node:util";
import { mkdir, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { log, spinner } from "@clack/prompts";

import { valid, option, value, GitSvcValue } from "./const";
import { regValue, meta, NPM, Conf, Plugin, PluginType } from "@/registry";
import { installTmplt, auth } from "@/command";
import { message as msg } from "@/message";

// can run from git option's github, or from cicd option's gha since github
// actions depends on github
async function run(this: Plugin, conf: Conf, gha?: true) {
  const s = spinner();
  s.start();
  log.info(format(message.pluginStart, this.label));

  if (!(await init())) {
    return;
  }

  const conf0 = parseConf(conf, gha);

  await install(conf0);
  const auth0 = await authGh(conf0, s);
  await checkScopes(s);
  const gh = await createGh({ ...conf0, ...auth0 });
  await setGh({ ...conf0, ...auth0, ...gh });
  setValue(conf, { ...conf0, ...auth0, ...gh });

  log.info(format(message.pluginFinish, this.label));
  s.stop();
}

const parseConf = (conf: Conf, gha?: true) => {
  const npm = conf.npm;
  if (npm !== NPM.npm && npm !== NPM.pnpm) {
    throw new Error();
  }
  const monorepo = conf.type === meta.plugin.type.monorepo;
  const name = conf[conf.type as PluginType]?.name;
  if (!name) {
    throw new Error();
  }
  const vis = gha
    ? value.gitVis.private
    : (conf[option.gitVis] as string | undefined) || value.gitVis.private;
  const deploy = parseDeploy(conf, vis, gha);
  const cicd = parseCicd(conf, gha);
  return {
    npm,
    monorepo,
    name,
    vis,
    ...deploy,
    ...cicd,
    forRepo: deploy.forRepo || cicd.forRepo,
  };
};

const parseDeploy = (conf: Conf, vis: string, gha?: true) => {
  if (gha) {
    return { forRepo: false, forReadToken: false };
  }
  const be = parseDeployBe(conf, vis);
  const fe = parseDeployFe(conf);
  const m = parseDeployM(conf);
  const pkg = parseDeployPkg(conf);
  return {
    forRepo: be.forRepo || fe.forRepo || m.forRepo || pkg.forRepo,
    forReadToken:
      be.forReadToken || fe.forReadToken || m.forReadToken || pkg.forReadToken,
  };
};

const parseDeployBe = (conf: Conf, _vis: string) => {
  let forRepo = false;
  const forReadToken = false;
  if (conf.backend?.deployment === value.deployment.render) {
    if (conf.backend?.[option.deploySrc] === value.deploySrc.repo) {
      // repo for deployment
      forRepo = true;
      // readToken (token with "repo") might be needed for private repo
      // deployment, but render actually uses render github app instead; note
      // that github's readToken is different to ghcr's readToken, which is for
      // docker image deployment with "read:packages"
      //if (vis === value.gitVis.private) {
      //  forReadToken = true;
      //}
    } else if (
      conf.backend?.[option.deploySrc] === value.deploySrc.dkrhub ||
      conf.backend?.[option.deploySrc] === value.deploySrc.ghcr
    ) {
      void 0;
    } else if (valid(conf.backend?.[option.deploySrc])) {
      throw new Error();
    }
  } else if (valid(conf.backend?.deployment)) {
    throw new Error();
  }
  return { forRepo, forReadToken };
};

const parseDeployFe = (conf: Conf) => {
  let forRepo = false;
  const forReadToken = false;
  if (conf.frontend?.deployment === value.deployment.render) {
    if (conf.frontend?.[option.deploySrc] === value.deploySrc.repo) {
      forRepo = true;
    } else if (
      conf.frontend?.[option.deploySrc] === value.deploySrc.dkrhub ||
      conf.frontend?.[option.deploySrc] === value.deploySrc.ghcr
    ) {
      void 0;
    } else if (valid(conf.frontend?.[option.deploySrc])) {
      throw new Error();
    }
  } else if (conf.frontend?.deployment === value.deployment.vercel) {
    void 0;
  } else if (valid(conf.frontend?.deployment)) {
    throw new Error();
  }
  return { forRepo, forReadToken };
};

const parseDeployM = (conf: Conf) => {
  const forRepo = false;
  const forReadToken = false;
  if (conf.mobile?.deployment === value.deployment.expo) {
    void 0;
  } else if (valid(conf.mobile?.deployment)) {
    throw new Error();
  }
  return { forRepo, forReadToken };
};

const parseDeployPkg = (conf: Conf) => {
  const forRepo = false;
  const forReadToken = false;
  if (
    conf.lib?.deployment === value.deployment.npmjs ||
    conf.cli?.deployment === value.deployment.npmjs
  ) {
    void 0;
  } else if (valid(conf.lib?.deployment) || valid(conf.cli?.deployment)) {
    throw new Error();
  }
  return { forRepo, forReadToken };
};

const parseCicd = (conf: Conf, gha?: true) => {
  if (gha) {
    return { forRepo: false, forToken: false };
  }
  const forRepo = false;
  const forToken = false;
  if (conf.cicd === value.cicd.gha) {
    void 0;
  } else if (conf.cicd === value.cicd.circle) {
    // repo might be needed for non-gha cicd to link to
    //forRepo = true;
    // token (with "admin:repo_hook") might be needed for non-gha cicd to link
    // to the repo; note that this token is different to ghcr's token, which is
    // for non-gha cicd to push docker image with "write:packages"
    //forToken = true;
    log.warn("todo: parse github conf for circle...");
  } else if (valid(conf.cicd)) {
    throw new Error();
  }
  return { forRepo, forToken };
};

const init = async () => {
  if (
    !(await exec(command.git)
      .then(() => true)
      .catch(() => false))
  ) {
    log.warn(message.noGit);
    return false;
  }
  if (
    !(await exec(command.gh)
      .then(() => true)
      .catch(() => false))
  ) {
    log.warn(message.noGh);
    return false;
  }
  return true;
};

type InstallData = { monorepo: boolean };

const install = async ({ monorepo }: InstallData) => {
  if (
    !(await access(template.name)
      .then(() => true)
      .catch(() => false)) ||
    monorepo
  ) {
    await installTmplt(base, { template }, "template");
  }
};

type AuthData = { forReadToken: boolean; forToken: boolean };

const authGh = async ({ forReadToken, forToken }: AuthData, s: Spinner) => {
  let user = (
    await exec(command.user).catch(() => ({ stdout: "" }))
  ).stdout.trim();
  if (!user) {
    log.info(command.login);
    s.stop();
    execSync(command.login, { stdio: "inherit" });
    s.start();
    user = (await exec(command.user)).stdout.trim();
  }
  const { readToken, token } = await auth(
    {
      ...(forReadToken && { readToken: readTokenPath }),
      ...(forToken && { token: tokenPath }),
    },
    {},
    forReadToken && forToken
      ? message.tokens
      : forReadToken
        ? message.readToken
        : message.token,
    tokenUrl,
    s,
  );
  if ((forReadToken && !readToken) || (forToken && !token)) {
    throw new Error();
  }
  return { user, readToken, token };
};

const checkScopes = async (s: Spinner) => {
  while (!(await getScopes()).includes(repoScope)) {
    log.warn(message.scopeRequired);
    log.info(command.refresh);
    s.stop();
    execSync(command.refresh, { stdio: "inherit" });
    s.start();
  }
};

type GhData = {
  user: string;
  name: string;
  vis: string;
  npm: NPM;
  forRepo?: boolean;
};

const createGh = async ({ user, name, vis, npm, forRepo }: GhData) => {
  const install = format(command.install, npm);
  log.info(install);
  await exec(install);
  log.info(command.init);
  await exec(command.init);
  log.info(command.add);
  await exec(command.add);
  log.info(command.ciInit);
  await exec(command.ciInit);
  const create = format(command.createGh, name, vis);
  log.info(create);
  await exec(create);
  log.info(command.rename);
  await exec(command.rename);
  const repo = format(repoFmt, user, name);
  const remote = format(command.remote, repo);
  log.info(remote);
  await exec(remote);
  log.info(command.pushu);
  await exec(command.pushu);
  if (forRepo) {
    return { repo };
  }
};

const setGh = async ({ user, name, vis }: GhData) => {
  if (vis === value.gitVis.public) {
    const rule = {
      required_pull_request_reviews: {
        required_approving_review_count: 1,
        require_code_owner_reviews: true,
      },
      required_status_checks: { strict: true, contexts: [] },
      enforce_admins: false,
      restrictions: null,
    };
    const cmd = format(command.pubRule, user, name);
    log.info(cmd);
    const exe = exec(cmd);
    exe.child.stdin!.write(JSON.stringify(rule));
    exe.child.stdin!.end();
    await exe;

    await mkdir(github);
    const text = `* @${user}
`;
    await writeFile(join(github, codeowners), text);
    await exec(command.add);
    await exec(command.ciCodeowner);
    await exec(command.push);
  }
};

const getScopes = async () => {
  return ((await exec(command.auth)).stdout.match(scopesRegx) ?? ["", ""])[1]
    .split(",")
    .map((e) => e.replace(/['"]/g, "").trim());
};

const setValue = (
  conf: Conf,
  { repo, readToken, token }: NonNullable<GitSvcValue>,
) => {
  (conf[value.git.github] as GitSvcValue) = { repo, readToken, token };
};

const label = "GitHub" as const;

regValue(
  {
    name: value.git.github,
    label,
    skips: [],
    keeps: [],
    requires: [],
    plugin: {
      name: `${meta.plugin.option.git}_${value.git.github}`,
      label,
      run,
    },
  },
  meta.plugin.option.git,
);

const exec = promisify(execAsync);

type Spinner = ReturnType<typeof spinner>;

const base =
  "https://raw.githubusercontent.com/bradhezh/prj-template/master/git/.gitignore" as const;
const template = { name: ".gitignore" } as const;

const command = {
  install: "%s i",
  git: "git --version",
  gh: "gh --version",
  init: "git init",
  add: "git add .",
  ciInit: 'git commit -m "init"',
  ciCodeowner: 'git commit -m "CODEOWNERS added"',
  auth: "gh auth status",
  user: "gh api user --jq .login",
  login: "gh auth login --scopes repo",
  refresh: "gh auth refresh --scopes repo",
  createGh: "gh repo create %s --%s",
  rename: "git branch -M master",
  remote: "git remote add origin %s",
  pushu: "git push -u origin master",
  push: "git push",
  pubRule:
    "gh api --method PUT /repos/%s/%s/branches/master/protection --input -",
} as const;

const tokenPath = "github.token" as const;
const readTokenPath = "github.read-token" as const;
const tokenUrl =
  "https://github.com/settings/tokens/new?description=bradhezh-create-prj-repo&scopes=repo" as const;
const repoFmt = "https://github.com/%s/%s.git";
const scopesRegx = /Token scopes: (.*)/i;
const repoScope = "repo" as const;
const github = ".github" as const;
const codeowners = "CODEOWNERS" as const;

const message = {
  ...msg,
  noGit: 'No "git" installed to create the repository.',
  noGh: 'No "gh" installed to create the repository on GitHub.',
  readToken:
    'Token needed for automated integration. Press [ENTER] to open your browser and create a token with the "repo" scope for deployment...',
  token:
    'Token needed for automated integration. Press [ENTER] to open your browser and create a token with the "admin:repo_hook" scope for CI/CD...',
  tokens:
    'Tokens needed for automated integration. Press [ENTER] to open your browser and create a token with the "repo" scope for deployment and a token with the "admin:repo_hook" scope for CI/CD...',
  scopeRequired: '"repo" required in scopes.',
} as const;
