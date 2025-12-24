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

type Option = typeof option;
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
type Conf0 = RecursiveWritable<ConfFromOpt<Option>>;
export type Conf = {
  name: string;
  volta: boolean;
  npm: "npm" | "pnpm";
} & Pick<Conf0, "type" | "compulsory"> &
  RecursivePartial<Omit<Conf0, "type" | "compulsory">>;

const flatOpt = (({ compulsory, optional, ...rest }) => ({
  ...rest,
  ...compulsory,
  ...optional,
}))(option);
export type FlatOpt = typeof flatOpt;

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
  optional: {
    q: "Accept optional ones with defaults, or configure them one by one, or choose none of them?",
    default:
      "Accept defaults (ESLint, Jest, GitHub, GitHub Actions, Render.com, Docker, and Prisma if applicable)",
    manual: "Configure manually",
  },
  opCanceled: "Operation cancelled.",
  pmUnsupported: "The tool can only support npm or pnpm for now.",
  pnpmForMono: "The tool can only support pnpm monorepo for now.",
} as const;

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

const none = {
  value: undefined,
  label: "None",
} as const;

export const prompt = {
  ...(Object.fromEntries(
    (Object.entries(flatOpt) as [keyof FlatOpt, FlatOpt[keyof FlatOpt]][])
      .filter(
        ([k, v]) =>
          typeof v === "object" &&
          (Object.keys(v).length > 1 || k in option.optional),
      )
      .map(([k, v]) => [
        k,
        {
          disable: false,
          selection: {
            message: message[k].q,
            options: [
              ...Object.values(v).map((e) => ({
                value: e,
                label: (message[k] as any)[e],
              })),
              ...(!(k in option.optional) ? [] : [none]),
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
  name: {
    message: message.name.q,
    initialValue: message.name.initial,
    validate: (value?: string) => (value ? undefined : message.name.validate),
  },
  monoBackend: {
    message: message.backend.q,
    options: [
      ...Object.values(option.backend).map((e) => ({
        value: e,
        label: message.backend[e],
      })),
      none,
    ],
  },
  monoFrontend: {
    message: message.frontend.q,
    options: [
      ...Object.values(option.frontend).map((e) => ({
        value: e,
        label: message.frontend[e],
      })),
      none,
    ],
  },
  monoMobile: {
    message: message.mobile.q,
    options: [
      ...Object.values(option.mobile).map((e) => ({
        value: e,
        label: message.mobile[e],
      })),
      none,
    ],
  },
  optional: {
    message: message.optional.q,
    initialValue: optional.option.default,
    options: [
      {
        value: optional.option.default,
        label: message.optional.default,
      },
      {
        value: optional.option.manual,
        label: message.optional.manual,
      },
      none,
    ],
  },
};

export const template = {
  url: "https://raw.githubusercontent.com/bradhezh/prj-template/master",
  package: {
    node: "package-node.json",
    express: "package-express.json",
    nest: "package-nest.json",
    monorepo: "package-mono.json",
    share: "package-share.json",
    lib: "package-lib.json",
    cli: "package-cli.json",
  },
} as const;
