import p from "@clack/prompts";

import { prompt, option, allSelfCreated, meta, NPM } from "@/conf";
import type {
  Conf,
  Type,
  OptionKey,
  OptionVal,
  NonOptionalKey,
  TypeOptionalKey,
  NonTypeOptionalKey,
} from "@/conf";

export const confFromUser = async () => {
  const conf: Conf = await init(detectEnv());
  await confTypes(conf);
  await confCompulsory(conf);
  await confOptional(conf);
  return conf;
};

const detectEnv = () => {
  if (process.env.npm_config_user_agent?.includes(NPM.pnpm)) {
    return NPM.pnpm;
  }
  if (process.env.npm_config_user_agent?.includes(NPM.npm)) {
    return NPM.npm;
  }
  throw new Error(prompt.message.pmUnsupported);
};

const init = async (npm: NPM) => {
  const answer = await p.group(
    {
      name: () => p.text(prompt.name),
      type: () => p.select(prompt.type!.selection),
    },
    { onCancel },
  );
  return {
    ...answer,
    npm,
    ...(Object.fromEntries(
      (Object.entries(option) as [OptionKey, OptionVal][])
        .filter(([k, _v]) => k !== "type" && k !== "optional")
        .map(([k, v]) => [k, Object.keys(v)[0]]),
    ) as { [K in NonOptionalKey]: Conf[K] }),
  };
};

const confTypes = async (conf: Conf) => {
  await confType(conf, conf.type);

  let types: Type[] | undefined;
  if (conf.type === option.type.monorepo) {
    if (conf.npm !== NPM.pnpm) {
      throw new Error(prompt.message.pnpmForMono);
    }
    types = conf.monorepo!.types as unknown as Type[];
    for (const type of types) {
      await confType(conf, type);
    }
  }

  if (conf.backend?.framework === option.optional.backend.framework.nest) {
    conf.typescript = option.typescript.decorator;
    void (prompt.typescript && (prompt.typescript.disable = true));
  }
  if (
    allSelfCreated(
      conf,
      conf.type !== option.type.monorepo ? [conf.type] : types!,
    )
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
  for (const key of (Object.keys(option) as OptionKey[]).filter(
    (e) => e !== "type" && e !== "optional",
  )) {
    if (prompt[key] && !prompt[key].disable) {
      const answer = await p.group(
        { selection: () => p.select(prompt[key]!.selection) },
        { onCancel },
      );
      (conf as any)[key] = answer.selection;
    }
  }
};

const confOptional = async (conf: Conf) => {
  const answer = await p.group(
    { selection: () => p.select(prompt.defaults) },
    { onCancel },
  );

  const keys = Object.keys(option.optional).filter(
    (e) => !Object.keys(option.type).includes(e),
  ) as NonTypeOptionalKey[];
  if (answer.selection === meta.defaults.option.default) {
    for (const key of keys.filter((e) =>
      Object.keys(meta.defaults).includes(e),
    )) {
      if (!conf[key]) {
        (conf as any)[key] = meta.defaults[key];
      }
    }
    return;
  }
  if (answer.selection === meta.defaults.option.manual) {
    prompt.deploy.disable = true;
    prompt.docker.disable = true;
    for (const key of keys) {
      if (!prompt[key].disable) {
        const answer = await p.group(
          { selection: () => p.select(prompt[key].selection) },
          { onCancel },
        );
        if (!answer.selection) {
          if (key === meta.key.option.git) {
            prompt.cicd.disable = true;
          }
          continue;
        }
        (conf as any)[key] = answer.selection;
        if (key === meta.key.option.cicd) {
          conf.deploy = meta.defaults.deploy;
          conf.docker = meta.defaults.docker;
        }
      }
    }
  }
};

const confType = async (conf: Conf, type: Type) => {
  if (!(type in option.optional)) {
    return;
  }
  const type0 = type as TypeOptionalKey;
  for (const key in option.optional[type0]) {
    const value = (option.optional[type0] as any)[key];
    const isArray = Array.isArray(value);
    (conf[type0] as any) = {
      ...(conf[type0] ?? {}),
      [key]: isArray ? [] : Object.keys(value)[0],
    };
    if (prompt[type0] && key in prompt[type0]) {
      const selection = (prompt[type0] as any)[key];
      const answer = await p.group(
        {
          selection: () =>
            isArray ? p.multiselect(selection) : p.select(selection),
        },
        { onCancel },
      );
      (conf[type0] as any)[key] = answer.selection;
    }
  }
};

const onCancel = () => {
  p.cancel(prompt.message.opCanceled);
  process.exit(0);
};
