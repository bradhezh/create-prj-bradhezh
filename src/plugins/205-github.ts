import { execSync, exec as execAsync } from "node:child_process";
import { promisify, format } from "node:util";
import { mkdir, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { log, spinner } from "@clack/prompts";

import { option, value, GitSvcValue, GitVisValue } from "./const";
import { regValue, meta, Conf, Plugin, PluginType } from "@/registry";
import { installTmplt, auth } from "@/command";
import { message as msg } from "@/message";

// can run from git option, or from gha of cicd option since ghaction depends on
// github
async function run(this: Plugin, conf: Conf, gha?: true) {
  const s = spinner();
  s.start();
  log.info(format(message.pluginStart, this.label));

  if (!(await init())) {
    return;
  }

  const { name, vis, forRepo, forReadToken, forToken } = parseConf(conf, gha);

  const { user, readToken, token } = await authGh(forReadToken, forToken, s);
  await checkScopes(s);
  const repo = await createGh(user, name, vis, forRepo);
  await setGh(user, name, vis);
  (conf[value.git.github] as GitSvcValue) = { repo, readToken, token };

  log.info(format(message.pluginFinish, this.label));
  s.stop();
}

const parseConf = (conf: Conf, gha?: true) => {
  const name = conf[conf.type as PluginType]?.name;
  if (!name) {
    throw new Error();
  }
  const vis = gha
    ? value.gitVis.private
    : ((conf[option.gitVis] ?? value.gitVis.private) as GitVis);
  // for repo deployment
  if (
    (conf.backend?.deployment &&
      conf.backend.deployment !== value.deployment.render) ||
    (conf.frontend?.deployment &&
      conf.frontend.deployment !== value.deployment.render &&
      conf.frontend.deployment !== value.deployment.vercel)
  ) {
    throw new Error();
  }
  const forRepo =
    !gha &&
    ((conf.backend?.deployment === value.deployment.render &&
      conf.backend?.[option.deploySrc] === value.deploySrc.repo) ||
      (conf.frontend?.deployment === value.deployment.render &&
        conf.frontend?.[option.deploySrc] === value.deploySrc.repo) ||
      (!!conf.cicd && conf.cicd !== value.cicd.gha));
  // different to ghcr's readToken, which is for docker image deployment and
  // then with "read:packages", but this one is supposed for repo deployment
  // with "repo"; however, render actually uses render github app instead
  const forReadToken =
    !gha &&
    forRepo &&
    vis === value.gitVis.private &&
    ((conf.backend?.[option.deploySrc] === value.deploySrc.repo &&
      conf.backend?.deployment !== value.deployment.render) ||
      (conf.frontend?.[option.deploySrc] === value.deploySrc.repo &&
        conf.frontend?.deployment !== value.deployment.render));
  // different to ghcr's token, which is for non-ghaction cicd to push docker
  // image and then with "write:packages", but this one is for them to link to
  // the repo with "admin:repo_hook"
  const forToken = !gha && !!conf.cicd && conf.cicd !== value.cicd.gha;
  return { name, vis, forRepo, forReadToken, forToken };
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
    !(await access(template.name)
      .then(() => true)
      .catch(() => false))
  ) {
    await installTmplt(base, { template }, "template");
  }
  log.info(command.init);
  await exec(command.init);
  log.info(command.add);
  await exec(command.add);
  log.info(command.ciInit);
  await exec(command.ciInit);
  if (
    await exec(command.gh)
      .then(() => true)
      .catch(() => false)
  ) {
    return true;
  }
  log.warn(message.noGh);
  return false;
};

const authGh = async (forReadToken: boolean, forToken: boolean, s: Spinner) => {
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
  return {
    user,
    ...(await auth(
      {
        ...(!forReadToken ? {} : { readToken: readTokenKey }),
        ...(!forToken ? {} : { token: tokenKey }),
      },
      {},
      forReadToken && forToken
        ? message.tokens
        : forReadToken
          ? message.readToken
          : message.token,
      tokenUrl,
      s,
    )),
  };
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

const createGh = async (
  user: string,
  name: string,
  vis: GitVis,
  forRepo: boolean,
) => {
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
    return repo;
  }
};

const setGh = async (user: string, name: string, vis: GitVis) => {
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

type GitVis = NonNullable<GitVisValue>;
type Spinner = ReturnType<typeof spinner>;

const base =
  "https://raw.githubusercontent.com/bradhezh/prj-template/master/git/.gitignore" as const;
const template = { name: ".gitignore" } as const;

const command = {
  git: "git --version",
  init: "git init",
  add: "git add .",
  ciInit: 'git commit -m "init"',
  ciCodeowner: 'git commit -m "CODEOWNERS added"',
  gh: "gh --version",
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

const tokenKey = "ghToken" as const;
const readTokenKey = "ghReadToken" as const;
const tokenUrl =
  "https://github.com/settings/tokens/new?description=bradhezh-create-prj-deploy" as const;
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
    'Token needed for automated integration.\nPress [ENTER] to open your browser and create a token with the "repo" scope for deployment...\n',
  token:
    'Token needed for automated integration.\nPress [ENTER] to open your browser and create a token with the "admin:repo_hook" scope for CI/CD...\n',
  tokens:
    'Tokens needed for automated integration.\nPress [ENTER] to open your browser and create a token with the "repo" scope for deployment and a token with the "admin:repo_hook" scope for CI/CD...\n',
  scopeRequired: '"repo" required in scopes.',
} as const;
