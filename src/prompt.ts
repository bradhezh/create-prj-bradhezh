import p from "@clack/prompts";
import { execSync } from "child_process";

import { prompt, option, message, optional, Conf, FlatOpt } from "@/conf";

export const confFromUser = async () => {
  const env = detectEvn();
  const conf: Conf = await init(env);
  await confType(conf);
  await confCompulsory(conf);
  await confOptional(conf);
  return conf;
};

const detectEvn = () => {
  let npm: Conf["npm"];
  if (process.env.npm_config_user_agent?.includes("pnpm")) {
    npm = "pnpm";
  } else if (process.env.npm_config_user_agent?.includes("npm")) {
    npm = "npm";
  } else {
    throw new Error(message.pmUnsupported);
  }
  let volta: boolean;
  try {
    execSync("volta -v", { stdio: "ignore" });
    volta = true;
  } catch {
    volta = false;
  }
  return { volta, npm };
};

const init = async (env: Pick<Conf, "volta" | "npm">) => {
  const answer = await p.group(
    {
      name: () => p.text(prompt.name),
      type: () => p.select(prompt.type!.selection),
    },
    { onCancel },
  );
  return {
    ...answer,
    ...env,
    compulsory: Object.fromEntries(
      Object.entries(option.compulsory).map(([k, v]) => [
        k,
        Object.values(v)[0],
      ]),
    ) as Conf["compulsory"],
  };
};

const confType = async (conf: Conf) => {
  if (conf.type === option.type.monorepo) {
    if (conf.npm !== "pnpm") {
      throw new Error(message.pnpmForMono);
    }
    const answer = await p.group(
      {
        backend: () => p.select(prompt.monoBackend),
        frontend: () => p.select(prompt.monoFrontend),
        mobile: () => p.select(prompt.monoMobile),
      },
      { onCancel },
    );
    conf.backend = answer.backend;
    conf.frontend = answer.frontend;
    conf.mobile = answer.mobile;
  } else if (conf.type in option) {
    const type = conf.type as keyof FlatOpt;
    (conf as any)[type] = Object.values(option[type as keyof typeof option])[0];
    if (type in prompt) {
      const answer = await p.group(
        { selection: () => p.select(prompt[type]!.selection) },
        { onCancel },
      );
      (conf as any)[type] = answer.selection;
    }
  }

  if (conf.backend === option.backend.nest) {
    conf.compulsory.typescript = option.compulsory.typescript.metadata;
    prompt.typescript!.disable = true;
  }
  if (
    conf.type === option.type.frontend ||
    conf.type === option.type.mobile ||
    (conf.type === option.type.monorepo && !conf.backend)
  ) {
    void (prompt.typescript && (prompt.typescript.disable = true));
    void (prompt.builder && (prompt.builder.disable = true));
    prompt.lint!.disable = true;
    prompt.test!.disable = true;
    prompt.deploy!.disable = true;
    prompt.docker!.disable = true;
  }
};

const confCompulsory = async (conf: Conf) => {
  for (const key in option.compulsory) {
    const k = key as keyof FlatOpt;
    if (k in prompt && !prompt[k]!.disable) {
      const answer = await p.group(
        { selection: () => p.select(prompt[k]!.selection) },
        { onCancel },
      );
      (conf.compulsory as any)[k] = answer.selection;
    }
  }
};

const confOptional = async (conf: Conf) => {
  const optionalAnswer = await p.group(
    { selection: () => p.select(prompt.optional) },
    { onCancel },
  );
  if (optionalAnswer.selection === optional.option.default) {
    if (!conf.optional) {
      conf.optional = {};
    }
    for (const key in optional.default) {
      const k = key as keyof typeof optional.default;
      if (!conf.optional[k]) {
        (conf.optional as any)[k] = optional.default[k];
      }
    }
    return;
  }
  if (optionalAnswer.selection === optional.option.manual) {
    for (const key in option.optional) {
      const k = key as keyof FlatOpt;
      if (!prompt[k]!.disable) {
        const answer = await p.group(
          { selection: () => p.select(prompt[k]!.selection) },
          { onCancel },
        );
        if (!answer.selection) {
          if (k === "git") {
            prompt.cicd!.disable = true;
            prompt.deploy!.disable = true;
            prompt.docker!.disable = true;
          }
          if (k === "cicd") {
            prompt.deploy!.disable = true;
            prompt.docker!.disable = true;
          }
          continue;
        }
        if (!conf.optional) {
          conf.optional = {};
        }
        (conf.optional as any)[k] = answer.selection;
      }
    }
  }
};

const onCancel = () => {
  p.cancel(message.opCanceled);
  process.exit(0);
};
