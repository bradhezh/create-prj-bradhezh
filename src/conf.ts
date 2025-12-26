export const option = {
  type: {
    node: "node",
    backend: "backend",
    frontend: "frontend",
    mobile: "mobile",
    monorepo: "monorepo",
    lib: "lib",
    cli: "cli",
  },
  backend: {
    express: "express",
    nest: "nest",
  },
  frontend: {
    react: "react",
    next: "next",
  },
  mobile: { expo: "expo" },
  lib: { npmjs: "npmjs" },
  cli: { npmjs: "npmjs" },
  compulsory: {
    typescript: {
      nodecorator: "nodecorator",
      decorator: "decorator",
      metadata: "metadata",
    },
    builder: { rspack: "rspack" },
  },
  optional: {
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
  inMonos: [option.type.backend, option.type.frontend, option.type.mobile],
  selfCreateds: [option.type.frontend, option.type.mobile],
  shared: "shared",
  withMultiplePkgTmplts: [option.type.backend],
} as const;

type ConfFromOpt<T> = T extends object
  ? T[keyof T] extends object
    ? { [K in keyof T]: ConfFromOpt<T[K]> }
    : T[keyof T]
  : T;
type RecursiveWritable<T> = T extends object
  ? { -readonly [K in keyof T]: RecursiveWritable<T[K]> }
  : T;
type RecursivePartial<T> = T extends object
  ? { [K in keyof T]?: RecursivePartial<T[K]> }
  : T;
type Conf0 = RecursiveWritable<ConfFromOpt<typeof option>>;
export enum NPM {
  npm = "npm",
  pnpm = "pnpm",
}
export type Conf = {
  name: string;
  volta: boolean;
  npm: NPM;
} & Pick<Conf0, "type" | "compulsory"> &
  RecursivePartial<Omit<Conf0, "type" | "compulsory">>;

export const optional = {
  option: {
    default: "default",
    manual: "manual",
  },
  default: {
    lint: option.optional.lint.eslint,
    test: option.optional.test.jest,
    git: option.optional.git.github,
    cicd: option.optional.cicd.ghactions,
    deploy: option.optional.deploy.render,
    docker: option.optional.docker.docker,
    orm: option.optional.orm.prisma,
  },
} as const;

const flatOpt = (({ compulsory, optional: optConf, ...rest }) => ({
  ...rest,
  ...compulsory,
  optional: optional.option,
  ...optConf,
}))(option);
type FlatOpt = typeof flatOpt;

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
    monorepo: "Monorepo with backend, frontend, or mobile",
    lib: "Library",
    cli: "CLI tool",
  },
  backend: {
    q: "Backend?",
    express: "Express",
    nest: "NestJS",
  },
  frontend: {
    q: "Frontend?",
    react: "React (Vite)",
    next: "Next.js",
  },
  mobile: {
    q: "Mobile?",
    expo: "Expo",
  },
  lib: {
    q: "Package registry for library?",
    npmjs: "npmjs",
  },
  cli: {
    q: "Package registry for CLI tool?",
    npmjs: "npmjs",
  },
  typescript: {
    q: "TypeScript decorator?",
    nodecorator: "No decorator",
    decorator: "Decorator",
    metadata: "Decorator with emitDecoratorMetadata",
  },
  builder: {
    q: "Builder?",
    rspack: "Rspack",
  },
  optional: {
    q: "Accept optional ones with defaults, or configure them one by one, or choose none of them?",
    default:
      "Accept defaults (ESLint, Jest, GitHub, GitHub Actions, Render.com, Docker, and Prisma if applicable)",
    manual: "Configure manually",
  },
  lint: {
    q: "Lint?",
    eslint: "ESLint",
  },
  test: {
    q: "Test framework?",
    jest: "Jest",
  },
  git: {
    q: "Git?",
    github: "GitHub",
  },
  cicd: {
    q: "CI/CD?",
    ghactions: "GitHub Actions",
  },
  deploy: {
    q: "Cloud for deployment?",
    render: "Render.com",
  },
  docker: {
    q: "Docker for deployment?",
    docker: "docker.io",
  },
  orm: {
    q: "ORM?",
    prisma: "Prisma",
  },
  opCanceled: "Operation cancelled.",
  pmUnsupported: "The tool can only support npm or pnpm for now.",
  pnpmForMono: "The tool can only support pnpm monorepo for now.",
  nextWkspaceRenamed:
    "frontend/pnpm-workspace.yaml has been renamed frontend/pnpm-workspace.yaml.bak, please check the content and merge it into the root one.",
  expoWkspaceRenamed:
    'mobile/pnpm-workspace.yaml has been renamed mobile/pnpm-workspace.yaml.bak and "nodeLinker: hoisted" has been merged into the root one, please check whether there are other configurations to be merged into the root one.',
  createVite: "create-vite ...",
  createNext: "create-next-app ...",
  createExpo: "create-expo-app ...",
} as const;

const none = {
  value: undefined,
  label: "None",
} as const;

export const prompt = {
  name: {
    message: message.name.q,
    initialValue: message.name.initial,
    validate: (value?: string) => (value ? undefined : message.name.validate),
  },
  ...(Object.fromEntries(
    (Object.entries(flatOpt) as [keyof FlatOpt, FlatOpt[keyof FlatOpt]][])
      .filter(
        ([k, v]) =>
          typeof v === "object" &&
          (Object.keys(v).length > 1 ||
            k in option.optional ||
            k === "optional"),
      )
      .map(([k, v]) => [
        k,
        {
          disable: false,
          selection: {
            message: message[k].q,
            ...(k !== "optional"
              ? {}
              : { initialValue: optional.option.default }),
            options: [
              ...Object.values(v).map((e) => ({
                value: e,
                label: (message[k] as any)[e],
              })),
              ...(!(k in option.optional || k === "optional") ? [] : [none]),
            ],
          },
        },
      ]),
  ) as {
    [K in keyof FlatOpt]?: {
      disable: boolean;
      selection: {
        message: string;
        options: {
          value: FlatOpt[K][keyof FlatOpt[K]];
          label: string;
        }[];
      };
    };
  }),
  monorepo: Object.fromEntries(
    type.inMonos
      .filter((k) => k in flatOpt && typeof flatOpt[k] === "object")
      .map((k) => [
        k,
        {
          message: message[k].q,
          options: [
            ...Object.values(flatOpt[k]).map((e) => ({
              value: e,
              label: (message[k] as any)[e],
            })),
            none,
          ],
        },
      ]),
  ) as {
    [K in (typeof type.inMonos)[number] & keyof FlatOpt]?: {
      message: string;
      options: {
        value: FlatOpt[K][keyof FlatOpt[K]];
        lable: string;
      }[];
    };
  },
  message,
} as const;

export const template = {
  url: "https://raw.githubusercontent.com/bradhezh/prj-template/master",
  package: {
    name: "package.json",
    node: "package/package-node.json",
    express: "package/package-express.json",
    nest: "package/package-nest.json",
    monorepo: "package/package-mono.json",
    shared: "package/package-shared.json",
    lib: "package/package-lib.json",
    cli: "package/package-cli.json",
  },
  pnpmWkspace: "pnpm-workspace.yaml",
  onlyBuiltDeps: {
    nest: ["@nestjs/core"],
  },
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
  pkgSetName: '%s pkg set name="%s"',
  pkgSetVoltaNode: '%s pkg set "volta.node"="%s"',
  pkgSetVoltaNpm: '%s pkg set "volta.%s"="%s"',
  pkgSetPkgMgr: '%s pkg set packageManager="%s@%s"',
  pkgSetBin: '%s pkg set "bin.%s"="dist/index.js"',
} as const;

export const meta = {
  key: {
    option: {
      git: "git",
      cicd: "cicd",
    },
  },
  type,
} as const;
