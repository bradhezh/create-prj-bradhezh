import p from "@clack/prompts";
import path from "node:path";
import { format } from "node:util";

import {
  options,
  meta,
  NPM,
  Conf,
  IPlugin,
  Option,
  Value,
  Category,
  PlugType,
} from "@/registry";
import { monorepo } from "@/monorepo";
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
  if (type.name === monorepo.name && npm !== NPM.pnpm) {
    throw new Error(message.pnpmRequired);
  }
  void (type.plugin && plugins.type.push(type.plugin));
  return { npm, type: type.name };
};

const confTypes = async (conf: Conf) => {
  const types: string[] = [];
  if (conf.type !== monorepo.name) {
    types.push(conf.type);
  } else {
    const { name, types: types0 } = await monoPrompt();
    plugins.type.push(...types0.filter((e) => e.plugin).map((e) => e.plugin!));
    conf.monorepo = { name, types: types0.map((e) => e.name) };
    types.push(...conf.monorepo.types);
  }

  for (const type of types) {
    const type0 = options.type.find((e) => e.name === type)!;
    conf[type as PlugType] = {};
    await confOptions(
      conf,
      type0.options,
      meta.system.option.category.type,
      type,
      conf.type === monorepo.name ? monorepo.label : type0.label,
    );
  }
};

const optional = {
  default: { value: "default", label: "Accept defaults" },
  manual: { value: "manual", label: "Configure manually" },
  none: { value: undefined, label: "None" },
} as const;
type None = typeof optional.none;

const confOptions = async (
  conf: Conf,
  opts: Option[],
  category: Category,
  type?: string,
  typeLabel?: string,
) => {
  if (category === meta.system.option.category.type && !(type && typeLabel)) {
    throw new Error(message.typeRequired);
  }
  const arg = optionPromptArg(conf, category, type, typeLabel);
  const conf0 = (
    category !== meta.system.option.category.type ? conf : conf[type!]
  ) as Record<string, string | string[]>;
  for (const opt of opts) {
    const answer = await optionPrompt(opt, arg);
    if (answer[opt.name] === optional.none.value) {
      continue;
    }
    setOptionValues(conf0, opt, category, answer);
  }
};

type Conf0 = Record<string, string | string[]>;
type Answer = {
  [x: string]: string | Value | Value[];
};

const setOptionValues = (
  conf: Conf0,
  option: Option,
  category: Category,
  answer: Answer,
) => {
  void (option.plugin && plugins.option[category].push(option.plugin));
  if (!option.values.length) {
    conf[option.name] = answer[option.name] as string;
    return;
  }
  if (!option.multiple) {
    const value = answer[option.name] as Value;
    void (value.plugin && plugins.value.push(value.plugin));
    conf[option.name] = value.name;
    return;
  }
  const values = answer[option.name] as Value[];
  plugins.value.push(...values.filter((e) => e.plugin).map((e) => e.plugin!));
  conf[option.name] = values.map((e) => e.name);
};

const confOptional = async (conf: Conf) => {
  if (!options.optional.length) {
    return;
  }
  const defOpts = options.optional.filter((e) => e.values.length);
  hintDefOpts(defOpts);
  const { optional: optl } = await optionalPrompt(defOpts);
  if (optl === optional.none.value) {
    return;
  }
  if (optl === optional.default.value) {
    for (const opt of defOpts) {
      void (opt.plugin && plugins.option.optional.push(opt.plugin));
      const value = opt.values[0];
      void (value.plugin && plugins.value.push(value.plugin));
      conf[opt.name] = !opt.multiple ? value.name : [value.name];
    }
    return;
  }
  await confOptions(
    conf,
    options.optional,
    meta.system.option.category.optional,
  );
};

const typePrompt = () => {
  return p.group(
    {
      type: () =>
        p.select({
          message: message.type.label,
          options: [
            ...options.type.map((e) => ({ value: e, label: e.label })),
            { value: monorepo, label: monorepo.label },
          ],
        }),
    },
    { onCancel },
  );
};

const monoPrompt = () => {
  return p.group(
    {
      name: () =>
        p.text({
          message: message.monorepo.name.label,
          initialValue: path.basename(process.cwd()),
          validate: (value?: string) => (value ? undefined : message.validate),
        }),
      types: () =>
        p.multiselect({
          message: message.monorepo.types.label,
          options: options.type.map((e) => ({ value: e, label: e.label })),
        }),
    },
    { onCancel },
  );
};

type OptionPromptParam = {
  label: string;
  iniName: string;
  none: None[];
};

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
        : conf.type === monorepo.name
          ? type!
          : path.basename(process.cwd()),
    none:
      category !== meta.system.option.category.optional
        ? []
        : [{ value: optional.none.value, label: optional.none.label }],
  };
};

const optionPrompt = (
  option: Option,
  { label, iniName, none }: OptionPromptParam,
) => {
  return p.group(
    {
      [option.name]: () =>
        !option.values.length
          ? p.text({
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
            ? p.select({
                message: `${label}${option.label}`,
                options: [
                  ...option.values.map((e) => ({ value: e, label: e.label })),
                  ...none,
                ],
              })
            : p.multiselect({
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
  return p.group(
    {
      optional: () =>
        p.select({
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

const hintDefOpts = (defOpts: Option[]) => {
  if (!defOpts.length) {
    p.log.info(
      format(
        message.optional.options.hint,
        options.optional.map((e) => e.name).join(),
      ),
    );
    return;
  }
  p.log.info(
    format(
      message.optional.defaults.hint,
      defOpts.map((e) => e.values[0].name).join(),
    ),
  );
};

const onCancel = () => {
  p.cancel(message.opCanceled);
  process.exit(0);
};
