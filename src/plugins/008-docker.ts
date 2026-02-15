import { group, text, log, spinner } from "@clack/prompts";
import { format } from "node:util";

import { option, value, DkrValue } from "./const";
import { regValue, meta, NPM, Conf, Plugin } from "@/registry";
import {
  installTmplt,
  auth,
  getConfig,
  setConfig,
  onCancel,
  defKey,
  Template,
} from "@/command";
import { message as msg } from "@/message";

const run = (type: DkrDeployType) => {
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
    const { image, monorepo, npm, lint, test, forToken, registry } =
      await parseConf(conf, reg, s);

    await install(monorepo, npm, type, lint, test);
    const { user, readToken, token } = await authDkr(reg, forToken, s);
    (conf[type]![reg] as DkrValue) = {
      registry,
      user,
      readToken,
      token,
      image,
    };

    log.info(
      format(
        message.pluginFinish,
        `${this.label.split("\n")[0]} for the ${type}`,
      ),
    );
    s.stop();
  };
};

const parseConf = async (conf: Conf, reg: string, s: Spinner) => {
  if (
    (conf.backend?.[option.deploySrc] === value.deploySrc.ghcr ||
      conf.backend?.[option.deploySrc] === value.deploySrc.dkrhub) &&
    (conf.frontend?.[option.deploySrc] === value.deploySrc.ghcr ||
      conf.frontend?.[option.deploySrc] === value.deploySrc.dkrhub)
  ) {
    throw new Error();
  }
  const image =
    reg === value.deploySrc.ghcr ? await iniImg(ghImg, ghReg, s) : undefined;
  const monorepo = conf.type === meta.plugin.type.monorepo;
  const npm = conf.npm;
  if (npm !== NPM.npm && npm !== NPM.pnpm) {
    throw new Error();
  }
  const lint = !!conf.lint;
  const test = !!conf.test;
  // for cicd
  const forToken =
    !!conf.cicd &&
    (conf.cicd !== value.cicd.gha || reg !== value.deploySrc.ghcr);
  if (!forToken) {
    return { image, monorepo, npm, lint, test, forToken };
  }
  let registry;
  if (reg === value.deploySrc.ghcr) {
    registry = ghReg;
  } else if (reg === value.deploySrc.dkrhub) {
    registry = dhReg;
  } else {
    throw new Error();
  }
  return { image, monorepo, npm, lint, test, forToken, registry };
};

const iniImg = async (key: string, registry: string, s: Spinner) => {
  const image = (await getConfig(key)) as string;
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
  await setConfig(key, answer.image);
  return answer.image;
};

const install = async (
  monorepo: boolean,
  npm: NPM,
  type: DkrDeployType,
  lint: boolean,
  test: boolean,
) => {
  await installTmplt(base, { ignoreTmplt }, "ignoreTmplt");
  const tmplt = template[monorepo ? "monorepo" : npm] ?? template.default;
  if (!tmplt) {
    throw new Error();
  }
  const tmplt0 = tmplt[type] ?? tmplt.default;
  if (!tmplt0) {
    throw new Error();
  }
  const tmplt1 = tmplt0[lint ? "lint" : defKey] ?? tmplt0.default;
  if (!tmplt1) {
    throw new Error();
  }
  await installTmplt(base, tmplt1, test ? "test" : defKey);
};

const authDkr = async (reg: string, forToken: boolean, s: Spinner) => {
  let userKey, readTokenKey, tokenKey, msg, url;
  if (reg === value.deploySrc.ghcr) {
    userKey = ghUser;
    readTokenKey = ghReadToken;
    tokenKey = ghToken;
    msg = forToken ? message.ghTokens : message.ghReadToken;
    url = ghTokenUrl;
  } else if (reg === value.deploySrc.dkrhub) {
    userKey = dhUser;
    readTokenKey = dhReadToken;
    tokenKey = dhToken;
    msg = forToken ? message.dhTokens : message.dhReadToken;
    url = dhTokenUrl;
  } else {
    throw new Error();
  }
  const { user, readToken, token } = await auth(
    {
      user: userKey,
      readToken: readTokenKey,
      ...(!forToken ? {} : { token: tokenKey }),
    },
    {},
    msg,
    url,
    s,
  );
  if (!user || !readToken) {
    throw new Error();
  }
  return { user, readToken, token };
};

for (const { name, label } of [
  {
    name: value.deploySrc.ghcr,
    label:
      'GitHub Container Registry\n|    Note: You must already have an arbitrary image in your ghcr.io registry\n|    as an initial placeholder for deployment.\n|    e.g. (Please use a token with "write:packages" to login)\n|    $ docker login ghcr.io -u <USERNAME>\n|    $ docker pull alpine:latest\n|    $ docker tag alpine:latest ghcr.io/<USERNAME>/alpine:latest\n|    $ docker push ghcr.io/<USERNAME>/alpine:latest',
  },
  { name: value.deploySrc.dkrhub, label: "Docker Hub" },
]) {
  regValue(
    {
      name,
      label,
      skips: [
        {
          type: meta.plugin.type.frontend,
          option: option.deploySrc,
          value: value.deploySrc.ghcr,
        },
        {
          type: meta.plugin.type.frontend,
          option: option.deploySrc,
          value: value.deploySrc.dkrhub,
        },
      ],
      keeps: [],
      requires: [],
      plugin: {
        name: `${meta.plugin.type.backend}_${option.deploySrc}_${name}`,
        label,
        run: run(meta.plugin.type.backend),
      },
    },
    option.deploySrc,
    meta.plugin.type.backend,
  );
  regValue(
    {
      name,
      label,
      skips: [],
      keeps: [],
      requires: [],
      plugin: {
        name: `${meta.plugin.type.frontend}_${option.deploySrc}_${name}`,
        label,
        run: run(meta.plugin.type.frontend),
      },
    },
    option.deploySrc,
    meta.plugin.type.frontend,
  );
}

type DkrDeployType =
  | typeof meta.plugin.type.backend
  | typeof meta.plugin.type.frontend;
type Spinner = ReturnType<typeof spinner>;

const base =
  "https://raw.githubusercontent.com/bradhezh/prj-template/master/dkr" as const;
const name = "Dockerfile" as const;

const ignoreTmplt = {
  name: ".dockerignore",
  path: "/ignore/.dockerignore",
} as const;

const template: Partial<
  Record<
    "monorepo" | NPM | typeof defKey,
    Partial<
      Record<
        DkrDeployType | typeof defKey,
        Partial<Record<"lint" | typeof defKey, Template<"test">>>
      >
    >
  >
> = {
  monorepo: {
    backend: {
      lint: {
        test: { name, path: "/file/mono/be/lint/test/Dockerfile" },
        default: { name, path: "/file/mono/be/lint/no/Dockerfile" },
      },
      default: {
        test: { name, path: "/file/mono/be/no/test/Dockerfile" },
        default: { name, path: "/file/mono/be/no/no/Dockerfile" },
      },
    },
    frontend: {
      lint: {
        test: { name, path: "/file/mono/fe/lint/test/Dockerfile" },
        default: { name, path: "/file/mono/fe/lint/no/Dockerfile" },
      },
      default: {
        test: { name, path: "/file/mono/fe/no/test/Dockerfile" },
        default: { name, path: "/file/mono/fe/no/no/Dockerfile" },
      },
    },
  },
  npm: {
    backend: {
      lint: {
        test: { name, path: "/file/npm/be/lint/test/Dockerfile" },
        default: { name, path: "/file/npm/be/lint/no/Dockerfile" },
      },
      default: {
        test: { name, path: "/file/npm/be/no/test/Dockerfile" },
        default: { name, path: "/file/npm/be/no/no/Dockerfile" },
      },
    },
    frontend: {
      lint: {
        test: { name, path: "/file/npm/fe/lint/test/Dockerfile" },
        default: { name, path: "/file/npm/fe/lint/no/Dockerfile" },
      },
      default: {
        test: { name, path: "/file/npm/fe/no/test/Dockerfile" },
        default: { name, path: "/file/npm/fe/no/no/Dockerfile" },
      },
    },
  },
  pnpm: {
    backend: {
      lint: {
        test: { name, path: "/file/pnpm/be/lint/test/Dockerfile" },
        default: { name, path: "/file/pnpm/be/lint/no/Dockerfile" },
      },
      default: {
        test: { name, path: "/file/pnpm/be/no/test/Dockerfile" },
        default: { name, path: "/file/pnpm/be/no/no/Dockerfile" },
      },
    },
    frontend: {
      lint: {
        test: { name, path: "/file/pnpm/fe/lint/test/Dockerfile" },
        default: { name, path: "/file/pnpm/fe/lint/no/Dockerfile" },
      },
      default: {
        test: { name, path: "/file/pnpm/fe/no/test/Dockerfile" },
        default: { name, path: "/file/pnpm/fe/no/no/Dockerfile" },
      },
    },
  },
} as const;

const ghReg = "ghcr.io" as const;
const ghImg = "ghImg" as const;
const ghUser = "ghUser" as const;
const ghToken = "ghToken" as const;
const ghReadToken = "ghReadToken" as const;
const ghTokenUrl =
  "https://github.com/settings/tokens/new?description=bradhezh-create-prj-read-pkg&scopes=read:packages" as const;
const dhReg = "docker.io" as const;
const dhUser = "dhUser" as const;
const dhToken = "dhToken" as const;
const dhReadToken = "dhReadToken" as const;
const dhTokenUrl =
  "https://app.docker.com/settings/personal-access-tokens" as const;

const message = {
  ...msg,
  imgGot: "Arbitrary image in the registry: ",
  defImg: "%s/<USERNAME>/alpine:latest",
  imgRequired: "Image required.",
  ghReadToken:
    'Token needed for automated integration.\nPress [ENTER] to open your browser and create a token with the "read:packages" scope for deployment...\n',
  ghTokens:
    'Tokens needed for automated integration.\nPress [ENTER] to open your browser and create a token with the "read:packages" scope for deployment and a token with the "write:packages" scope for CI/CD...\n',
  dhReadToken:
    "Token needed for automated integration.\nPress [ENTER] to open your browser and create a read-only token for deployment...\n",
  dhTokens:
    "Tokens needed for automated integration.\nPress [ENTER] to open your browser and create a read-only token for deployment and a read-write token for CI/CD...\n",
} as const;
