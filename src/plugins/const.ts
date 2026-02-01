import { meta } from "@/registry";

export const option = {
  deploySrc: "deploySrc",
  reactDeploy: "reactDeploy",
  nextDeploy: "nextDeploy",
  expoDeploy: "expoDeploy",
  gitVis: "gitVis",
} as const;

export const value = {
  framework: {
    express: "express",
    nest: "nest",
    react: "react",
    next: "next",
    expo: "expo",
  },
  typescript: { nodec: "nodec", metadata: "metadata" },
  deployment: {
    render: "render",
    vercel: "vercel",
    expo: "expo",
    npmjs: "npmjs",
  },
  deploySrc: { docker: "docker", example: "example" },
  builder: { rspack: "rspack" },
  test: { jest: "jest" },
  lint: { eslint: "eslint" },
  git: { github: "github" },
  gitVis: { public: "public", private: "private" },
  cicd: { ghaction: "ghaction" },
  orm: { prisma: "prisma" },
  done: "done",
} as const;
export type FrmwkValue = keyof typeof value.framework | undefined;
export type TsValue =
  | keyof typeof value.typescript
  | typeof meta.plugin.value.none
  | undefined;
export type DeployValue =
  | keyof typeof value.deployment
  | typeof meta.plugin.value.none
  | undefined;
export type DeploySrcValue = keyof typeof value.deploySrc | undefined;
export type BuilderValue = keyof typeof value.builder | undefined;
export type TestValue =
  | keyof typeof value.test
  | typeof meta.plugin.value.none
  | undefined;
export type LintValue =
  | keyof typeof value.lint
  | typeof meta.plugin.value.none
  | undefined;
export type GitValue =
  | keyof typeof value.git
  | typeof meta.plugin.value.none
  | undefined;
export type GitVisValue = keyof typeof value.gitVis | undefined;
export type CicdValue =
  | keyof typeof value.cicd
  | typeof meta.plugin.value.none
  | undefined;
export type OrmValue =
  | keyof typeof value.orm
  | typeof meta.plugin.value.none
  | undefined;

export const rtConf = {
  github: "github",
  dkrUsername: "dkrUsername",
  dkrToken: "dkrToken",
  dkrReadToken: "dkrReadToken",
  example: "example",
} as const;
export type RtConf = Partial<{
  github: typeof value.done;
  dkrUsername: string;
  dkrToken: string;
  dkrReadToken: string;
  example: string;
}>;
export type GitHubData = RtConf["github"];
export type GitData = GitHubData | undefined;
export type DkrData = Partial<{
  username: RtConf["dkrUsername"];
  token: RtConf["dkrToken"];
  readToken: RtConf["dkrReadToken"];
}>;
export type ExampleData = RtConf["example"];
export type DeploySrcData = DkrData | ExampleData | undefined;
