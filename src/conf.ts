import { AllKeys, AllVals } from "@/types";

export const option = {
  type: {
    node: "node",
    backend: "backend",
    frontend: "frontend",
    mobile: "mobile",
    lib: "lib",
    cli: "cli",
    monorepo: "monorepo",
  },
  typescript: {
    nodecorator: "nodecorator",
    decorator: "decorator",
  },
  builder: { rspack: "rspack" },
  optional: {
    backend: { framework: { express: "express", nest: "nest" } },
    frontend: { framework: { vite: "vite", next: "next" } },
    mobile: { framework: { expo: "expo" } },
    lib: { registry: { npmjs: "npmjs" } },
    cli: { registry: { npmjs: "npmjs" } },
    monorepo: { types: ["backend", "frontend", "mobile"] },
    lint: { eslint: "eslint" },
    test: { jest: "jest" },
    git: { github: "github" },
    cicd: { ghactions: "ghactions" },
    deploy: { render: "render" },
    docker: { docker: "docker" },
    orm: { prisma: "prisma" },
  },
} as const;

const type = {
  selfCreateds: [
    {
      name: option.type.frontend,
      framework: [
        option.optional.frontend.framework.vite,
        option.optional.frontend.framework.next,
      ],
    },
    option.type.mobile,
  ],
  withMultiplePkgTmplts: [option.type.backend],
  shared: "shared",
} as const;

const defaults = {
  lint: option.optional.lint.eslint,
  test: option.optional.test.jest,
  git: option.optional.git.github,
  cicd: option.optional.cicd.ghactions,
  deploy: option.optional.deploy.render,
  docker: option.optional.docker.docker,
  orm: option.optional.orm.prisma,
  option: { default: "default", manual: "manual" },
} as const;

export type Option = typeof option;
export type OptionKey = keyof Option;
export type OptionVal = Option[OptionKey];
export type NonOptionalKey = Exclude<OptionKey, "optional">;
export type Optional = Option["optional"];
export type OptionalKey = keyof Optional;
export type OptionalVal = Optional[OptionalKey];
export type TypeOptionalKey = OptionalKey & keyof Option["type"];
export type TypeOptionalVal = Optional[TypeOptionalKey];
export type TypeOptionalValKey = AllKeys<TypeOptionalVal>;
export type TypeOptionalValVal = AllVals<TypeOptionalVal>;
export type NonTypeOptionalKey = Exclude<OptionalKey, TypeOptionalKey>;
export type SelfCreated = (typeof type.selfCreateds)[number];
export type SelfCreatedObj = SelfCreated & object;
export type SelfCreatedObjKey = keyof SelfCreatedObj;
export type SelfCreatedObjVal = SelfCreatedObj[SelfCreatedObjKey];
export type SelfCreatedName =
  | Exclude<SelfCreated, SelfCreatedObj>
  | SelfCreatedObj["name"];
type ConfFromOption<T> = T extends number | string | boolean | unknown[]
  ? T
  : T[keyof T] extends number | string | boolean | unknown[]
    ? T[keyof T]
    : {
        [K in Exclude<keyof T, "optional">]: ConfFromOption<T[K]>;
      } & (T extends { optional: unknown }
        ? {
            [K in keyof ConfFromOption<T["optional"]>]?: ConfFromOption<
              T["optional"]
            >[K];
          }
        : unknown);
export enum NPM {
  npm = "npm",
  pnpm = "pnpm",
}
export type Conf = { name: string; npm: NPM } & ConfFromOption<Option>;
export type Type = Conf["type"];
export type NonSelfCreatedType = Exclude<
  Exclude<Type, "monorepo">,
  SelfCreatedName
>;
export type WithMultiplePkgTmplt = (typeof type.withMultiplePkgTmplts)[number];
export type ConfWithMultiplePkgTmplt = Conf[WithMultiplePkgTmplt];
export type ConfWithMultiplePkgTmpltKey = AllKeys<ConfWithMultiplePkgTmplt>;
export type ConfWithMultiplePkgTmpltVal = AllVals<ConfWithMultiplePkgTmplt>;
export type WithSinglePkgTemplt = Exclude<
  NonSelfCreatedType,
  WithMultiplePkgTmplt
>;

export const allSelfCreated = (conf: Conf, types: Type[]) => {
  return !types.filter(
    (e) =>
      !type.selfCreateds.filter((e0) =>
        typeof e0 === "string"
          ? e0 === e
          : e0.name === e &&
            (
              Object.entries(e0) as [SelfCreatedObjKey, SelfCreatedObjVal][]
            ).filter(
              ([k, v]) =>
                k !== "name" && conf[e] && v.includes((conf[e] as any)[k]),
            ).length,
      ).length,
  ).length;
};

export const message = {
  name: {
    q: "Project name?",
    initial: "my-prj",
    validate: "Please enter a name.",
  },
  type: {
    q: "Project type?",
    node: "Node.js",
    backend: "Backend",
    frontend: "Frontend",
    mobile: "Mobile",
    lib: "Library",
    cli: "CLI tool",
    monorepo: "Monorepo",
  },
  typescript: {
    q: "TypeScript decorator?",
    nodecorator: "No decorator",
    decorator: "Decorator with emitDecoratorMetadata",
  },
  builder: { q: "Builder?", rspack: "Rspack" },
  backend: {
    framework: { q: "Backend framework?", express: "Express", nest: "NestJS" },
  },
  frontend: {
    framework: {
      q: "Frontend framework?",
      vite: "Vite",
      next: "Next.js",
    },
  },
  mobile: { framework: { q: "Mobile framework?", expo: "Expo" } },
  lib: { registry: { q: "Library package registry?", npmjs: "npmjs" } },
  cli: { registry: { q: "CLI tool package registry?", npmjs: "npmjs" } },
  monorepo: {
    types: {
      q: "Types in monorepo?",
      backend: "Backend",
      frontend: "Frontend",
      mobile: "Mobile",
    },
  },
  defaults: {
    q: "Accept defaults, or configure them one by one, or choose none of them?",
    default:
      "Accept defaults (ESLint, Jest, GitHub, GitHub Actions, Render.com, Docker, and Prisma if applicable)",
    manual: "Configure manually",
  },
  lint: { q: "Lint?", eslint: "ESLint" },
  test: { q: "Test framework?", jest: "Jest" },
  git: { q: "Git?", github: "GitHub" },
  cicd: { q: "CI/CD?", ghactions: "GitHub Actions" },
  deploy: { q: "Cloud for deployment?", render: "Render.com" },
  docker: { q: "Docker for deployment?", docker: "docker.io" },
  orm: { q: "ORM?", prisma: "Prisma" },
  cwdNonEmpty: "The current work directory must be empty.",
  opCanceled: "Operation cancelled.",
  pmUnsupported: "The tool can only support npm or pnpm for now.",
  pnpmForMono: "The tool can only support pnpm monorepo for now.",
  createPrj: "Creating projects",
  createVite: "create-vite ...",
  createNext: "create-next-app ...",
  createExpo: "create-expo-app ...",
  noSelfCreateCmd: "No CLI for creation of %d.",
  noTmplt: "No template for %s.",
  nextWkspaceRenamed:
    "frontend/pnpm-workspace.yaml has been renamed frontend/pnpm-workspace.yaml.bak, please check the content and merge it into the root one.",
  expoWkspaceRenamed:
    'mobile/pnpm-workspace.yaml has been renamed mobile/pnpm-workspace.yaml.bak and "nodeLinker: hoisted" has been merged into the root one, please check whether there are other configurations to be merged into the root one.',
  proceed: "Proceeding",
  prjCreated: "Creation completed!",
  noteWidth: 70,
} as const;

export type Spinner = {
  start: (msg?: string) => void;
  stop: (msg?: string, code?: number) => void;
};

const none = { value: undefined, label: "None" } as const;

export const prompt = {
  name: {
    message: message.name.q,
    initialValue: message.name.initial,
    validate: (value?: string) => (value ? undefined : message.name.validate),
  },
  ...(Object.fromEntries(
    (
      (Object.entries(option) as [OptionKey, OptionVal][]).filter(
        ([k, v]) => k !== "optional" && Object.keys(v).length > 1,
      ) as [NonOptionalKey, OptionVal][]
    ).map(([k, v]) => [
      k,
      {
        disable: false,
        selection: {
          message: message[k].q,
          options: Object.keys(v).map((e) => ({
            value: e,
            label: (message[k] as any)[e],
          })),
        },
      },
    ]),
  ) as {
    [K in NonOptionalKey]?: {
      disable: boolean;
      selection: {
        message: string;
        options: { value: keyof Option[K]; label: string }[];
      };
    };
  }),
  ...(Object.fromEntries(
    (Object.keys(option.optional) as OptionalKey[])
      .filter(
        (e) =>
          e in option.type &&
          (Object.values(option.optional[e]) as TypeOptionalValVal[]).filter(
            (e0) =>
              Array.isArray(e0) ? e0.length : Object.keys(e0).length > 1,
          ).length,
      )
      .map((e) => [
        e,
        Object.fromEntries(
          (
            Object.entries(option.optional[e]) as [
              TypeOptionalValKey,
              TypeOptionalValVal,
            ][]
          )
            .filter(([_k, v]) =>
              Array.isArray(v) ? v.length : Object.keys(v).length > 1,
            )
            .map(([k, v]) => {
              const msgu = message[e] as any;
              return [
                k,
                {
                  message: msgu[k].q,
                  options: Array.isArray(v)
                    ? v.map((e0) => ({
                        value: e0,
                        label: msgu[k][e0],
                      }))
                    : Object.keys(v).map((e0) => ({
                        value: e0,
                        label: msgu[k][e0],
                      })),
                },
              ];
            }),
        ),
      ]),
  ) as {
    [K in TypeOptionalKey]?: {
      [K0 in keyof Optional[K]]?: {
        message: string;
        options: {
          value: Optional[K][K0] extends unknown[]
            ? Optional[K][K0][number]
            : keyof Optional[K][K0];
          label: string;
        }[];
      };
    };
  }),
  ...(Object.fromEntries(
    (
      Object.entries(option.optional).filter(
        ([k, _v]) => !(k in option.type),
      ) as [NonTypeOptionalKey, OptionalVal][]
    ).map(([k, v]) => [
      k,
      {
        disable: false,
        selection: {
          message: message[k].q,
          options: [
            ...Object.keys(v).map((e) => ({
              value: e,
              label: (message[k] as any)[e],
            })),
            none,
          ],
        },
      },
    ]),
  ) as {
    [K in NonTypeOptionalKey]: {
      disable: boolean;
      selection: {
        message: string;
        options: { value: keyof Optional[K]; label: string }[];
      };
    };
  }),
  defaults: {
    message: message.defaults.q,
    options: [
      { value: defaults.option.default, label: message.defaults.default },
      { value: defaults.option.manual, label: message.defaults.manual },
      none,
    ],
  },
  message,
};

export const template = {
  url: "https://raw.githubusercontent.com/bradhezh/prj-template/master",
  package: {
    name: "package.json",
    node: "package/package-node.json",
    express: "package/package-express.json",
    nest: "package/package-nest.json",
    monorepo: "package/package-mono.json",
    monoFeMobile: "package/package-mono-fe-mobile.json",
    monoBeNext: "package/package-mono-be-next.json",
    monoBeNextMobile: "package/package-mono-be-next-mobile.json",
    monoBeFe: "package/package-mono-be-fe.json",
    monoBeFeMobile: "package/package-mono-be-fe-mobile.json",
    monoBeMobile: "package/package-mono-be-mobile.json",
    shared: "package/package-shared.json",
    lib: "package/package-lib.json",
    cli: "package/package-cli.json",
  },
  pnpmWkspace: "pnpm-workspace.yaml",
  onlyBuiltDeps: { nest: ["@nestjs/core"] },
  bak: ".bak",
  src: "src",
  git: ".git",
  message,
} as const;

export const cmd = {
  voltaV: "volta -v",
  nodeV: "node -v",
  npmV: `%s -v`,
  pnpmV: "pnpm -v",
  createVite: "%s create vite %s --template react-ts",
  createNext:
    "%s create next-app %s --ts --no-react-compiler --no-src-dir -app --api --eslint --tailwind --skip-install --disable-git",
  createExpo: "%s create expo-app %s --no-install",
  setPkgName: '%s pkg set name="%s"',
  setPkgVoltaNode: '%s pkg set "volta.node"="%s"',
  setPkgVoltaNpm: '%s pkg set "volta.%s"="%s"',
  setPkgPkgMgr: '%s pkg set packageManager="%s@%s"',
  setPkgBin: '%s pkg set "bin.%s"="dist/index.js"',
  setPkgScripts: '%s pkg set "scripts.%s"="%s"',
  script: {
    vite: { name: "start", script: "vite preview" },
    eas: {
      name: "build",
      script: "eas build --platform android --profile development",
    },
  },
  setPkgDevDeps: '%s pkg set "devDependencies.%s"="%s"',
  dep: {
    vercel: { name: "vercel", version: "^48" },
    eas: { name: "eas-cli", version: "^16" },
  },
} as const;

export const meta = {
  key: { option: { git: "git", cicd: "cicd" } },
  type,
  defaults,
} as const;
