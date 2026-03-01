import { group, text, log, spinner } from "@clack/prompts";
import { format } from "node:util";

import { valid, option, value, DkrValue } from "./const";
import { regValue, meta, NPM, Conf, Plugin, PrimeType } from "@/registry";
import {
  installTmplt,
  auth,
  getCfg,
  setCfg,
  onCancel,
  defKey,
  Template,
} from "@/command";
import { message as msg } from "@/message";

const run = (type: PrimeType) => {
  return async function (this: Plugin, conf: Conf) {
    const s = spinner();
    s.start();
    log.info(
      format(
        message.pluginStart,
        `${this.label.split("\n")[0]} for the ${type}`,
      ),
    );

    const reg = this.name.split("_").at(-1)!;
    const conf0 = await parseConf(conf, type, reg, s);

    await install(conf0);
    const auth0 = await authDkr(conf0, s);
    setValue(conf, { ...conf0, ...auth0 });

    log.info(
      format(
        message.pluginFinish,
        `${this.label.split("\n")[0]} for the ${type}`,
      ),
    );
    s.stop();
  };
};

const parseConf = async (
  conf: Conf,
  type: PrimeType,
  reg: string,
  s: Spinner,
) => {
  const npm = conf.npm;
  if (npm !== NPM.npm && npm !== NPM.pnpm) {
    throw new Error();
  }
  const monorepo = conf.type === meta.plugin.type.monorepo;
  const lint = !!conf.lint;
  const test = !!conf.test;
  const deploy = await parseDeploy(conf, type, reg, s);
  const cicd = parseCicd(conf, reg);
  return { type, reg, npm, monorepo, lint, test, ...deploy, ...cicd };
};

const parseDeploy = async (
  conf: Conf,
  type: PrimeType,
  reg: string,
  s: Spinner,
) => {
  if (
    (type !== meta.plugin.type.backend && type !== meta.plugin.type.frontend) ||
    ((conf.backend?.[option.deploySrc] === value.deploySrc.dkrhub ||
      conf.backend?.[option.deploySrc] === value.deploySrc.ghcr) &&
      (conf.frontend?.[option.deploySrc] === value.deploySrc.dkrhub ||
        conf.frontend?.[option.deploySrc] === value.deploySrc.ghcr))
  ) {
    throw new Error();
  }
  let image;
  if (reg === value.deploySrc.dkrhub) {
    void 0;
  } else if (reg === value.deploySrc.ghcr) {
    image = await iniImg(ghcrImgPath, ghcrReg, s);
  } else {
    throw new Error();
  }
  return { image };
};

const parseCicd = (conf: Conf, reg: string) => {
  let forToken = false;
  let registry;
  if (
    valid(conf.cicd) &&
    (conf.cicd !== value.cicd.gha || reg !== value.deploySrc.ghcr)
  ) {
    forToken = true;
    if (reg === value.deploySrc.dkrhub) {
      registry = dhReg;
    } else if (reg === value.deploySrc.ghcr) {
      registry = ghcrReg;
    } else {
      throw new Error();
    }
  }
  return { forToken, registry };
};

const iniImg = async (path: string, registry: string, s: Spinner) => {
  const image = await getCfg(path);
  if (typeof image !== "string" && typeof image !== "undefined") {
    throw new Error();
  }
  if (image) {
    return image;
  }
  s.stop();
  const answer = await group(
    {
      image: () =>
        text({
          message: message.imgGot,
          placeholder: format(message.defImg, registry),
          validate: (value?: string) =>
            value ? undefined : message.imgRequired,
        }),
    },
    { onCancel },
  );
  s.start();
  await setCfg(answer.image, path);
  return answer.image;
};

type InstallData = {
  monorepo: boolean;
  npm: NPM;
  type: PrimeType;
  lint: boolean;
  test: boolean;
};

const install = async ({ monorepo, npm, type, lint, test }: InstallData) => {
  await installTmplt(base, { ignoreTmplt }, "ignoreTmplt");
  const tmplt = template[monorepo ? "mono" : npm] ?? template.def;
  if (!tmplt) {
    throw new Error();
  }
  const tmplt0 = tmplt[type] ?? tmplt.def;
  if (!tmplt0) {
    throw new Error();
  }
  const tmplt1 = tmplt0[lint ? "lint" : defKey] ?? tmplt0.def;
  if (!tmplt1) {
    throw new Error();
  }
  await installTmplt(base, tmplt1, test ? "test" : defKey, ".", true);
};

type AuthData = { reg: string; forToken: boolean };

const authDkr = async ({ reg, forToken }: AuthData, s: Spinner) => {
  let userPath, readTokenPath, tokenPath, msg, url;
  if (reg === value.deploySrc.dkrhub) {
    userPath = dhUserPath;
    readTokenPath = dhReadTokenPath;
    tokenPath = dhTokenPath;
    msg = forToken ? message.dhTokens : message.dhReadToken;
    url = dhTokenUrl;
  } else if (reg === value.deploySrc.ghcr) {
    userPath = ghcrUserPath;
    readTokenPath = ghcrReadTokenPath;
    tokenPath = ghcrTokenPath;
    msg = forToken ? message.ghcrTokens : message.ghcrReadToken;
    url = ghcrTokenUrl;
  } else {
    throw new Error();
  }
  const { user, readToken, token } = await auth(
    {
      user: userPath,
      readToken: readTokenPath,
      ...(forToken && { token: tokenPath }),
    },
    {},
    msg,
    url,
    s,
  );
  if (!user || !readToken || (forToken && !token)) {
    throw new Error();
  }
  return { user, readToken, token };
};

type Value = { type: PrimeType; reg: string } & NonNullable<DkrValue>;

const setValue = (
  conf: Conf,
  { type, reg, user, readToken, image, token, registry }: Value,
) => {
  (conf[type]![reg] as DkrValue) = { user, readToken, image, token, registry };
};

for (const { type, skips } of [
  {
    type: meta.plugin.type.backend,
    skips: [
      {
        type: meta.plugin.type.frontend,
        option: option.deploySrc,
        value: value.deploySrc.dkrhub,
      },
      {
        type: meta.plugin.type.frontend,
        option: option.deploySrc,
        value: value.deploySrc.ghcr,
      },
    ],
  },
  { type: meta.plugin.type.frontend, skips: [] },
]) {
  for (const { name, label } of [
    { name: value.deploySrc.dkrhub, label: "Docker Hub" },
    {
      name: value.deploySrc.ghcr,
      label:
        'GitHub Container Registry\n|    Note: You must already have an arbitrary image in your ghcr.io registry\n|    as an initial placeholder for deployment.\n|    e.g. (Please use a token with "write:packages" to login)\n|    $ docker login ghcr.io -u <USERNAME>\n|    $ docker pull alpine:latest\n|    $ docker tag alpine:latest ghcr.io/<USERNAME>/alpine:latest\n|    $ docker push ghcr.io/<USERNAME>/alpine:latest',
    },
  ]) {
    regValue(
      {
        name,
        label,
        skips,
        keeps: [],
        requires: [],
        plugin: {
          name: `${type}_${option.deploySrc}_${name}`,
          label,
          run: run(type),
        },
      },
      option.deploySrc,
      type,
    );
  }
}

type Spinner = ReturnType<typeof spinner>;

const base =
  "https://raw.githubusercontent.com/bradhezh/prj-template/master/dkr" as const;
const name = "dkr.tar" as const;

const template: Partial<
  Record<
    "mono" | NPM | typeof defKey,
    Partial<
      Record<
        PrimeType | typeof defKey,
        Partial<Record<"lint" | typeof defKey, Template<"test">>>
      >
    >
  >
> = {
  mono: {
    backend: {
      lint: {
        test: { name, path: "/file/mono/be/lint/test/dkr.tar" },
        def: { name, path: "/file/mono/be/lint/no/dkr.tar" },
      },
      def: {
        test: { name, path: "/file/mono/be/no/test/dkr.tar" },
        def: { name, path: "/file/mono/be/no/no/dkr.tar" },
      },
    },
    frontend: {
      lint: {
        test: { name, path: "/file/mono/fe/lint/test/dkr.tar" },
        def: { name, path: "/file/mono/fe/lint/no/dkr.tar" },
      },
      def: {
        test: { name, path: "/file/mono/fe/no/test/dkr.tar" },
        def: { name, path: "/file/mono/fe/no/no/dkr.tar" },
      },
    },
  },
  npm: {
    backend: {
      lint: {
        test: { name, path: "/file/npm/be/lint/test/dkr.tar" },
        def: { name, path: "/file/npm/be/lint/no/dkr.tar" },
      },
      def: {
        test: { name, path: "/file/npm/be/no/test/dkr.tar" },
        def: { name, path: "/file/npm/be/no/no/dkr.tar" },
      },
    },
    frontend: {
      lint: {
        test: { name, path: "/file/npm/fe/lint/test/dkr.tar" },
        def: { name, path: "/file/npm/fe/lint/no/dkr.tar" },
      },
      def: {
        test: { name, path: "/file/npm/fe/no/test/dkr.tar" },
        def: { name, path: "/file/npm/fe/no/no/dkr.tar" },
      },
    },
  },
  pnpm: {
    backend: {
      lint: {
        test: { name, path: "/file/pnpm/be/lint/test/dkr.tar" },
        def: { name, path: "/file/pnpm/be/lint/no/dkr.tar" },
      },
      def: {
        test: { name, path: "/file/pnpm/be/no/test/dkr.tar" },
        def: { name, path: "/file/pnpm/be/no/no/dkr.tar" },
      },
    },
    frontend: {
      lint: {
        test: { name, path: "/file/pnpm/fe/lint/test/dkr.tar" },
        def: { name, path: "/file/pnpm/fe/lint/no/dkr.tar" },
      },
      def: {
        test: { name, path: "/file/pnpm/fe/no/test/dkr.tar" },
        def: { name, path: "/file/pnpm/fe/no/no/dkr.tar" },
      },
    },
  },
} as const;

const ignoreTmplt = {
  name: ".dockerignore",
  path: "/ignore/.dockerignore",
} as const;

const dhReg = "docker.io" as const;
const dhUserPath = "docker-hub.user" as const;
const dhReadTokenPath = "docker-hub.read-token" as const;
const dhTokenPath = "docker-hub.token" as const;
const dhTokenUrl =
  "https://app.docker.com/settings/personal-access-tokens" as const;
const ghcrReg = "ghcr.io" as const;
const ghcrUserPath = "github-cr.user" as const;
const ghcrReadTokenPath = "github-cr.read-token" as const;
const ghcrImgPath = "github-cr.image" as const;
const ghcrTokenPath = "github-cr.token" as const;
const ghcrTokenUrl =
  "https://github.com/settings/tokens/new?description=bradhezh-create-prj-read-pkg&scopes=read:packages" as const;

const message = {
  ...msg,
  imgGot: "Arbitrary image in the registry: ",
  defImg: "%s/<USERNAME>/alpine:latest",
  imgRequired: "Image required.",
  dhReadToken:
    "Token needed for automated integration.\nPress [ENTER] to open your browser and create a read-only token for deployment...\n",
  dhTokens:
    "Tokens needed for automated integration.\nPress [ENTER] to open your browser and create a read-only token for deployment and a read-write token for CI/CD...\n",
  ghcrReadToken:
    'Token needed for automated integration.\nPress [ENTER] to open your browser and create a token with the "read:packages" scope for deployment...\n',
  ghcrTokens:
    'Tokens needed for automated integration.\nPress [ENTER] to open your browser and create a token with the "read:packages" scope for deployment and a token with the "write:packages" scope for CI/CD...\n',
} as const;
