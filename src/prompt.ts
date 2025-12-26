import p from "@clack/prompts";
import { execSync } from "child_process";

import { prompt, option, optional, cmd, meta, NPM, Conf } from "@/conf";

export const confFromUser = async () => {
  const env = detectEnv();
  const conf: Conf = await init(env);
  await confType(conf);
  await confCompulsory(conf);
  await confOptional(conf);
  return conf;
};

const detectEnv = () => {
  let npm: NPM;
  if (process.env.npm_config_user_agent?.includes(NPM.pnpm)) {
    npm = NPM.pnpm;
  } else if (process.env.npm_config_user_agent?.includes(NPM.npm)) {
    npm = NPM.npm;
  } else {
    throw new Error(prompt.message.pmUnsupported);
  }
  let volta: boolean;
  try {
    execSync(cmd.voltaV, { stdio: "ignore" });
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
    if (conf.npm !== NPM.pnpm) {
      throw new Error(prompt.message.pnpmForMono);
    }
    const answer = await p.group(
      Object.fromEntries(
        Object.entries(prompt.monorepo).map(([k, v]) => [k, () => p.select(v)]),
      ),
      { onCancel },
    );
    for (const key in answer) {
      (conf as any)[key] = answer[key];
    }
  } else if (conf.type in option) {
    (conf as any)[conf.type] = Object.values(
      option[conf.type as keyof typeof option],
    )[0];
    if (conf.type in prompt) {
      const answer = await p.group(
        {
          selection: () =>
            p.select(
              prompt[conf.type as keyof typeof option & keyof typeof prompt]!
                .selection,
            ),
        },
        { onCancel },
      );
      (conf as any)[conf.type] = answer.selection;
    }
  }

  if (conf.backend === option.backend.nest) {
    conf.compulsory.typescript = option.compulsory.typescript.metadata;
    void (prompt.typescript && (prompt.typescript.disable = true));
  }
  if (
    (meta.type.selfCreateds as readonly Conf["type"][]).includes(conf.type) ||
    (conf.type === option.type.monorepo &&
      !meta.type.inMonos.filter(
        (e) =>
          conf[e] &&
          !(meta.type.selfCreateds as readonly Conf["type"][]).includes(e),
      ).length)
  ) {
    void (prompt.typescript && (prompt.typescript.disable = true));
    void (prompt.builder && (prompt.builder.disable = true));
    void (prompt.lint && (prompt.lint.disable = true));
    void (prompt.test && (prompt.test.disable = true));
    void (prompt.deploy && (prompt.deploy.disable = true));
    void (prompt.docker && (prompt.docker.disable = true));
  }
};

const confCompulsory = async (conf: Conf) => {
  for (const key in option.compulsory) {
    const k = key as keyof typeof option.compulsory;
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
    { selection: () => p.select(prompt.optional!.selection) },
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
      const k = key as keyof typeof option.optional;
      if (!prompt[k]!.disable) {
        const answer = await p.group(
          { selection: () => p.select(prompt[k]!.selection) },
          { onCancel },
        );
        if (!answer.selection) {
          if (k === meta.key.option.git) {
            prompt.cicd!.disable = true;
            prompt.deploy!.disable = true;
            prompt.docker!.disable = true;
          }
          if (k === meta.key.option.cicd) {
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
  p.cancel(prompt.message.opCanceled);
  process.exit(0);
};
