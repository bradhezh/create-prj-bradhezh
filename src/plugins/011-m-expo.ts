import { execSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import Json from "comment-json";
import { createInterface } from "node:readline/promises";
import { log, spinner } from "@clack/prompts";
import { format } from "node:util";

import { valid, value, ExpoValue } from "./const";
import {
  regValue,
  meta,
  PosMode,
  NPM,
  Conf,
  Plugin,
  PrimeType,
} from "@/registry";
import { auth } from "@/command";
import { message as msg } from "@/message";

const run = (type: PrimeType) => {
  return async function (this: Plugin, conf: Conf) {
    const s = spinner();
    s.start();
    log.info(format(message.pluginStart, `${this.label} for the ${type}`));

    const conf0 = parseConf(conf, type);
    if (!conf0) {
      return;
    }

    const auth0 = await authExpo(conf0, s);
    await createExpo({ ...conf0, ...auth0 }, s);
    setValue(conf, { ...conf0, ...auth0 });

    log.info(format(message.pluginFinish, `${this.label} for the ${type}`));
    s.stop();
  };
};

const parseConf = (conf: Conf, type: PrimeType) => {
  const npm = conf.npm;
  if (npm !== NPM.npm && npm !== NPM.pnpm) {
    throw new Error();
  }
  const name = conf[conf.type as PrimeType]?.name;
  if (!name) {
    throw new Error();
  }
  const deploy = parseDeploy(conf, type);
  if (!deploy) {
    return;
  }
  const cicd = parseCicd(conf);
  return { type, npm, name, ...deploy, ...cicd };
};

const parseDeploy = (conf: Conf, type: PrimeType) => {
  if (type !== meta.plugin.type.mobile || !valid(conf.git)) {
    throw new Error();
  }
  if (!conf[conf.git!]) {
    log.warn(message.noGit);
    return;
  }
  const cwd = conf.type !== meta.plugin.type.monorepo ? "." : conf[type]?.name;
  if (!cwd) {
    throw new Error();
  }
  return { cwd };
};

const parseCicd = (conf: Conf) => {
  const forToken = valid(conf.cicd);
  return { forToken };
};

type AuthData = { forToken: boolean };

const authExpo = async ({ forToken }: AuthData, s: Spinner) => {
  const { token } = await auth(
    { ...(forToken && { token: tokenPath }) },
    {},
    message.token,
    tokenUrl,
    s,
  );
  if (forToken && !token) {
    throw new Error();
  }
  return { token };
};

type ExpoData = { npm: NPM; name: string; cwd: string };

const createExpo = async ({ npm, name, cwd }: ExpoData, s: Spinner) => {
  const file = join(cwd, config);
  const doc = Json.parse(await readFile(file, "utf-8").catch(() => "{}"));
  if (
    typeof doc !== "object" ||
    doc === null ||
    Array.isArray(doc) ||
    typeof doc.expo !== "object" ||
    doc.expo === null ||
    Array.isArray(doc.expo) ||
    typeof doc.expo.name !== "string" ||
    typeof doc.expo.slug !== "string"
  ) {
    throw new Error();
  }
  doc.expo.name = name;
  doc.expo.slug = name;
  const text =
    Json.stringify(doc, null, 2).replace(/\[\s+"([^"]+)"\s+\]/g, '["$1"]') +
    "\n";
  await writeFile(file, text);

  const link = npm === NPM.npm ? command.npmLink : command.pnpmLink;
  log.info(link);
  s.stop();
  execSync(link, { stdio: "inherit", cwd });
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(message.build)).trim().toLowerCase();
  rl.close();
  if (!answer || answer === "y" || answer === "yes") {
    const preview =
      npm === NPM.npm ? command.npmAdrPreview : command.pnpmAdrPreview;
    log.info(preview);
    execSync(preview, { stdio: "inherit", cwd });
  }
  s.start();
};

type Value = { type: PrimeType } & NonNullable<ExpoValue>;

const setValue = (conf: Conf, { type, token }: Value) => {
  (conf[type]![value.deployment.expo] as ExpoValue) = { token };
};

const label = "Expo" as const;

regValue(
  {
    name: value.deployment.expo,
    label,
    skips: [
      {
        type: meta.plugin.type.lib,
        option: meta.plugin.option.type.deployment,
      },
      {
        type: meta.plugin.type.cli,
        option: meta.plugin.option.type.deployment,
      },
    ],
    keeps: [],
    requires: [{ option: meta.plugin.option.git }],
    plugin: {
      name: `${meta.plugin.type.mobile}_${meta.plugin.option.type.deployment}_${value.deployment.expo}`,
      label,
      pos: { mode: PosMode.after, refs: [meta.plugin.option.git] },
      run: run(meta.plugin.type.mobile),
    },
  },
  meta.plugin.option.type.deployment,
  meta.plugin.type.mobile,
);

type Spinner = ReturnType<typeof spinner>;

const command = {
  npmLink: "npx eas-cli build:configure",
  pnpmLink: "pnpm dlx eas-cli build:configure",
  npmAdrPreview: "npx eas-cli build --platform android --profile preview",
  pnpmAdrPreview: "pnpm dlx eas-cli build --platform android --profile preview",
} as const;

const tokenPath = "expo.token" as const;
const tokenUrl = "https://expo.dev/settings/access-tokens" as const;
const config = "app.json" as const;

const message = {
  ...msg,
  noGit:
    "Cannot work as expected because the plugin for the Git option has not run successfully.",
  token:
    "Token needed for automated integration. Press [ENTER] to open your browser and create a read-write token for CI/CD...",
  build:
    "Now you can use eas-cli to build the project on Expo. Note that you should first use eas-cli locally in interactive mode before using it non-interactively in CI/CD. The build process will take a few minutes. You can run it now or at anytime. Do you want to run it now? (Y/n)",
} as const;
