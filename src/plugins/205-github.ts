import { execSync, exec as execAsync } from "node:child_process";
import { promisify, format } from "node:util";
import { mkdir, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { log, spinner } from "@clack/prompts";

import { option, value, rtConf, RtConf, GitVisValue } from "./const";
import { regValue, meta, Conf, Plugin, PluginType } from "@/registry";
import { installTmplt } from "@/command";
import { message as msg } from "@/message";

async function run(this: Plugin, conf: Conf) {
  const s = spinner();
  s.start();
  log.info(format(message.pluginStart, this.label));

  if (await init()) {
    const name = conf[conf.type as PluginType]?.name ?? conf.type;
    const vis = (conf[option.gitVis] ?? value.gitVis.private) as GitVis;

    const user = await checkAuth(s);
    await checkScopes(s);
    await createGh(user, name, vis);
    await setGh(user, name, vis);
    (conf[rtConf.github] as RtConf["github"]) = value.done;
  }

  log.info(format(message.pluginFinish, this.label));
  s.stop();
}

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
    await installTmplt(base, { git: template }, "git");
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

const checkAuth = async (s: Spinner) => {
  try {
    return (await exec(command.user)).stdout.trim();
  } catch {
    log.info(command.login);
    s.stop();
    execSync(command.login, { stdio: "inherit" });
    s.start();
    return (await exec(command.user)).stdout.trim();
  }
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

const createGh = async (user: string, name: string, vis: GitVis) => {
  const create = format(command.createGh, name, vis);
  log.info(create);
  await exec(create);
  log.info(command.rename);
  await exec(command.rename);
  const remote = format(command.remote, user, name);
  log.info(remote);
  await exec(remote);
  log.info(command.pushu);
  await exec(command.pushu);
};

const setGh = async (user: string, name: string, vis: GitVis) => {
  await exec(format(command.setVar, nameVar, name));
  if (vis !== value.gitVis.public) {
    return;
  }
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
};

const getScopes = async () => {
  return (await exec(command.auth)).stdout
    .match(scopesPattern)![1]
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
  "https://raw.githubusercontent.com/bradhezh/prj-template/master/git/gitignore" as const;
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
  remote: "git remote add origin https://github.com/%s/%s.git",
  pushu: "git push -u origin master",
  push: "git push",
  setVar: "gh variable set %s --body %s",
  pubRule:
    "gh api --method PUT /repos/%s/%s/branches/master/protection --input -",
} as const;

const scopesPattern = /Token scopes: (.*)/i;
const repoScope = "repo" as const;
const nameVar = "NAME" as const;
const github = ".github" as const;
const codeowners = "CODEOWNERS" as const;

const message = {
  ...msg,
  noGit: 'No "git" installed to create the repository.',
  noGh: 'No "gh" installed to create the repository on GitHub.',
  scopeRequired: '"repo" required in scopes.',
} as const;
