import { group, text, select, multiselect, cancel, log } from "@clack/prompts";
import { basename } from "node:path";
import { format } from "node:util";
import wrapAnsi from "wrap-ansi";

import {
  enableOptions,
  options,
  meta,
  NPM,
  Conf,
  IPlugin,
  Option,
  Value,
  Category,
  PluginType,
} from "@/registry";
import { message } from "@/message";

export const plugins: {
  type: IPlugin[];
  option: { [K in Category]: IPlugin[] };
  value: IPlugin[];
} = { type: [], option: { type: [], compulsory: [], optional: [] }, value: [] };

export const config = async () => {
  const conf: Conf = await init();
  await confTypes(conf);
  await confOptions(
    conf,
    options.compulsory,
    meta.system.option.category.compulsory,
  );
  await confOptional(conf);
  return conf;
};

const init = async () => {
  let npm;
  if (process.env.npm_config_user_agent?.includes(NPM.pnpm)) {
    npm = NPM.pnpm;
  } else if (process.env.npm_config_user_agent?.includes(NPM.npm)) {
    npm = NPM.npm;
  } else {
    throw new Error(message.pmUnsupported);
  }
  const { type } = await typePrompt();
  if (type.name === meta.system.type.monorepo && npm !== NPM.pnpm) {
    throw new Error(message.pnpmRequired);
  }
  const conf = { npm, type: type.name };
  enableOptions(conf, type);
  void (type.plugin && plugins.type.push(type.plugin));
  return conf;
};

const confTypes = async (conf: Conf) => {
  const types: string[] = [];
  let monoLabel;
  if (conf.type !== meta.system.type.monorepo) {
    types.push(conf.type);
  } else {
    const { name, types: types0 } = await monoPrompt();
    conf.monorepo = { name, types: types0.map((e) => e.name) };
    for (const type of types0) {
      enableOptions(conf, type);
      void (type.plugin && plugins.type.push(type.plugin));
    }
    types.push(...conf.monorepo.types);
    const monorepo = options.type.find(
      (e) => e.name === meta.system.type.monorepo,
    )!;
    monoLabel = monorepo.label;
    await confOptions(
      conf,
      monorepo.options,
      meta.system.option.category.type,
      monorepo.name,
      monoLabel,
    );
  }

  for (const type of types) {
    conf[type as PluginType] = {};
    const type0 = options.type.find((e) => e.name === type)!;
    await confOptions(
      conf,
      type0.options,
      meta.system.option.category.type,
      type,
      monoLabel ?? type0.label,
    );
  }
};

type OptionConf = Record<string, string | string[]>;

const confOptions = async (
  conf: Conf,
  opts: Option[],
  category: Category,
  type?: string,
  typeLabel?: string,
) => {
  const opts0 = opts.filter((e) => !e.disabled);
  if (!opts0.length) {
    return;
  }
  if (category === meta.system.option.category.type && !(type && typeLabel)) {
    throw new Error(message.typeRequired);
  }
  const arg = optionPromptArg(conf, category, type, typeLabel);
  const optConf = (
    category !== meta.system.option.category.type ? conf : conf[type!]
  ) as OptionConf;
  for (const opt of opts0) {
    if (opt.disabled) {
      continue;
    }
    const answer = await optionPrompt(opt, arg);
    setOptionValues(conf, optConf, opt, category, answer);
  }
};

type Answer = Record<string, string | Value | Value[]>;

const setOptionValues = (
  conf: Conf,
  optConf: OptionConf,
  option: Option,
  category: Category,
  answer: Answer,
) => {
  void (option.plugin && plugins.option[category].push(option.plugin));
  if (!option.values.length) {
    optConf[option.name] = answer[option.name] as string;
    return;
  }
  if (!option.multiple) {
    const value = answer[option.name] as Value;
    optConf[option.name] = value.name;
    enableOptions(conf, value);
    void (value.plugin && plugins.value.push(value.plugin));
    return;
  }
  const values = answer[option.name] as Value[];
  optConf[option.name] = values.map((e) => e.name);
  for (const value of values) {
    enableOptions(conf, value);
    void (value.plugin && plugins.value.push(value.plugin));
  }
};

const optional = {
  default: { value: "default", label: "Accept defaults" },
  manual: { value: "manual", label: "Configure manually" },
  none: { value: undefined, label: "None" },
} as const;

const confOptional = async (conf: Conf) => {
  const opts = options.optional.filter((e) => !e.disabled);
  if (!opts.length) {
    return;
  }
  const defOpts = opts.filter((e) => e.values.length);
  hintDefOpts(opts, defOpts);
  const { optional: optl } = await optionalPrompt(defOpts);
  if (optl === optional.none.value) {
    return;
  }
  if (optl === optional.manual.value) {
    await confOptions(
      conf,
      options.optional,
      meta.system.option.category.optional,
    );
    return;
  }
  if (optl !== optional.default.value) {
    return;
  }
  for (const opt of defOpts) {
    void (opt.plugin && plugins.option.optional.push(opt.plugin));
    const value = opt.values[0];
    conf[opt.name] = !opt.multiple ? value.name : [value.name];
    void (value.plugin && plugins.value.push(value.plugin));
  }
};

const typePrompt = () => {
  return group(
    {
      type: () =>
        select({
          message: message.type.label,
          options: options.type.map((e) => ({ value: e, label: e.label })),
        }),
    },
    { onCancel },
  );
};

const monoPrompt = () => {
  return group(
    {
      name: () =>
        text({
          message: message.monorepo.name.label,
          initialValue: basename(process.cwd()),
          validate: (value?: string) => (value ? undefined : message.validate),
        }),
      types: () =>
        multiselect({
          message: message.monorepo.types.label,
          options: options.type
            .filter((e) => e.name !== meta.system.type.monorepo)
            .map((e) => ({ value: e, label: e.label })),
        }),
    },
    { onCancel },
  );
};

type OptionPromptParam = { label: string; iniName: string };

const optionPromptArg = (
  conf: Conf,
  category: Category,
  type?: string,
  typeLabel?: string,
) => {
  return {
    label:
      category !== meta.system.option.category.type ? "" : `${typeLabel} | `,
    iniName:
      category !== meta.system.option.category.type
        ? ""
        : conf.type === meta.system.type.monorepo
          ? type!
          : basename(process.cwd()),
  };
};

const optionPrompt = (
  option: Option,
  { label, iniName }: OptionPromptParam,
) => {
  return group(
    {
      [option.name]: () =>
        !option.values.length
          ? text({
              message: `${label}${option.label}`,
              initialValue:
                option.initial ??
                (option.name !== meta.plugin.option.type.common.name
                  ? ""
                  : iniName),
              validate: option.optional
                ? undefined
                : (value?: string) => (value ? undefined : message.validate),
            })
          : !option.multiple
            ? select({
                message: `${label}${option.label}`,
                options: option.values.map((e) => ({
                  value: e,
                  label: e.label,
                })),
              })
            : multiselect({
                message: `${label}${option.label}`,
                options: option.values.map((e) => ({
                  value: e,
                  label: e.label,
                })),
              }),
    },
    { onCancel },
  );
};

const optionalPrompt = (defOpts: Option[]) => {
  return group(
    {
      optional: () =>
        select({
          message: !defOpts.length
            ? message.optional.options.label
            : message.optional.defaults.label,
          options: [
            ...(!defOpts.length
              ? []
              : [
                  {
                    value: optional.default.value,
                    label: optional.default.label,
                  },
                ]),
            { value: optional.manual.value, label: optional.manual.label },
            { value: optional.none.value, label: optional.none.label },
          ],
        }),
    },
    { onCancel },
  );
};

const hintDefOpts = (opts: Option[], defOpts: Option[]) => {
  if (!defOpts.length) {
    log.info(
      wrapAnsi(
        format(
          message.optional.options.hint,
          opts.map((e) => e.label).join(", "),
        ),
        message.noteWidth,
      ),
    );
    return;
  }
  log.info(
    wrapAnsi(
      format(
        message.optional.defaults.hint,
        defOpts.map((e) => `${e.label}: ${e.values[0].label}`).join(", "),
      ),
      message.noteWidth,
    ),
  );
};

const onCancel = () => {
  cancel(message.opCanceled);
  process.exit(0);
};
