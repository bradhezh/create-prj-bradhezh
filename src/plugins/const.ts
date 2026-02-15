import { meta } from "@/registry";

export const option = { deploySrc: "deploySrc", gitVis: "gitVis" } as const;

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
  deploySrc: { ghcr: "ghcr", dkrhub: "dkrhub", repo: "repo" },
  builder: { rspack: "rspack" },
  test: { jest: "jest" },
  lint: { eslint: "eslint" },
  git: { github: "github", gitlab: "gitlab" },
  gitVis: { public: "public", private: "private" },
  cicd: { gha: "gha", circle: "circle" },
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

type RtEmpty = { [K in never]: never } | undefined;
export type DkrValue =
  | {
      registry?: string;
      user: string;
      readToken: string;
      token?: string;
      image?: string;
    }
  | undefined;
export type DeploySrcConf = DkrValue | RtEmpty;
export type GitSvcValue =
  | { repo?: string; readToken?: string; token?: string }
  | undefined;
export type GitConf = GitSvcValue | RtEmpty;
export type RenderValue =
  | { owner: string; service: string; token: string; cred?: string }
  | undefined;
export type CLIDeployValue = { token?: string } | undefined;
export type DeployConf = RenderValue | CLIDeployValue | RtEmpty;
