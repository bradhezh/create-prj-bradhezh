import { execSync, exec as execAsync } from "node:child_process";
import { promisify, format } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import axios from "axios";
import p from "@clack/prompts";

import { option, value } from "./const";
import { regValue, meta, Conf, ConfType, Spinner } from "@/registry";
import { message as msg } from "@/message";

const exec = promisify(execAsync);

const message = {
  ...msg,
  noGit: 'No "git" installed to create the repository.',
  noGh: 'No "gh" installed to create the repository on GitHub.',
  scopeRequired:
    '"admin:repo_hook" required in scopes to set branch protection rules for the public repository.',
  noPubScope:
    'no "admin:repo_hook" selected, no branch protection rules will be set.',
} as const;

const template = {
  url: "https://raw.githubusercontent.com/bradhezh/prj-template/master/git/gitignore",
  name: ".gitignore",
} as const;

const run = async (conf: Conf, s: Spinner) => {
  if (!(await checkGit())) {
    p.log.warn(message.noGit);
    return;
  }
  await writeFile(
    template.name,
    (await axios.get(template.url, { responseType: "text" })).data,
  );
  await createGit();
  if (!(await checkGh())) {
    p.log.warn(message.noGh);
    return;
  }

  const name = conf[conf.type as ConfType]?.name ?? conf.type;
  const vis = conf[option.gitVis] as string;

  const user = await checkAuth(vis, s);
  const scope = await checkScope(vis, s);
  await createGh(user, name, vis);
  if (scope) {
    await setPubRule(user, name);
  }
};

regValue(
  {
    name: value.git.github,
    label: "GitHub",
    plugin: { run },
    disables: [],
    enables: [],
  },
  meta.plugin.option.git,
  undefined,
  0,
);

const command = {
  git: "git --version",
  init: "git init",
  add: "git add .",
  ciInit: 'git commit -m "init"',
  ciCodeowner: 'git commit -m "CODEOWNERS added"',
  gh: "gh --version",
  auth: "gh auth status",
  user: "gh api user --jq .login",
  login: "gh auth login",
  loginPubRule: 'gh auth login --scopes "admin:repo_hook,repo"',
  refresh: "gh auth refresh --scopes admin:repo_hook",
  createGh: "gh repo create %s --%s",
  rename: "git branch -M master",
  remote: "git remote add origin https://github.com/%s/%s.git",
  pushu: "git push -u origin master",
  push: "git push",
  pubRule:
    "gh api --method PUT /repos/%s/%s/branches/master/protection --input -",
} as const;

const checkGit = async () => {
  return exec(command.git)
    .then(() => true)
    .catch(() => false);
};

const checkGh = async () => {
  return exec(command.gh)
    .then(() => true)
    .catch(() => false);
};

const checkAuth = async (vis: string, s: Spinner) => {
  try {
    return (await exec(command.user)).stdout.trim();
  } catch {
    const cmd =
      vis !== value.gitVis.public ? command.login : command.loginPubRule;
    p.log.info(cmd);
    s.stop();
    execSync(cmd, { stdio: "inherit" });
    s.start(message.proceed);
    return (await exec(command.user)).stdout.trim();
  }
};

const checkScope = async (vis: string, s: Spinner) => {
  if (vis !== value.gitVis.public || (await hasPubScope())) {
    return true;
  }
  p.log.warn(message.scopeRequired);
  p.log.info(command.refresh);
  s.stop();
  execSync(command.refresh, { stdio: "inherit" });
  s.start(message.proceed);
  const scope = await hasPubScope();
  if (!scope) {
    p.log.warn(message.noPubScope);
  }
  return scope;
};

const createGit = async () => {
  p.log.info(command.init);
  await exec(command.init);
  p.log.info(command.add);
  await exec(command.add);
  p.log.info(command.ciInit);
  await exec(command.ciInit);
};

const createGh = async (user: string, name: string, vis: string) => {
  const create = format(command.createGh, name, vis);
  p.log.info(create);
  await exec(create);
  p.log.info(command.rename);
  await exec(command.rename);
  const remote = format(command.remote, user, name);
  p.log.info(remote);
  await exec(remote);
  p.log.info(command.pushu);
  await exec(command.pushu);
};

const githubDir = ".github" as const;
const codeowners = "CODEOWNERS" as const;

const setPubRule = async (user: string, name: string) => {
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
  p.log.info(cmd);
  const exe = exec(cmd);
  exe.child.stdin!.write(JSON.stringify(rule));
  exe.child.stdin!.end();
  await exe;

  await mkdir(githubDir);
  const text = `* @${user}
`;
  await writeFile(path.join(githubDir, codeowners), text);
  await exec(command.add);
  await exec(command.ciCodeowner);
  await exec(command.push);
};

const scopesPattern = /Token scopes: (.*)/i;
const pubScope = "admin:repo_hook" as const;

const hasPubScope = async () => {
  const status = (await exec(command.auth)).stdout;
  const matches = status.match(scopesPattern);
  return (
    matches &&
    matches[1] &&
    matches[1]
      .split(",")
      .map((e) => e.replace(/['"]/g, "").trim())
      .includes(pubScope)
  );
};
