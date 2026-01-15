import { message } from "@/message";

export const meta = {
  plugin: {
    type: {
      node: "node",
      cli: "cli",
      lib: "lib",
      backend: "backend",
      frontend: "frontend",
      mobile: "mobile",
    },
    option: {
      type: {
        common: { name: "name" },
        backend: { framework: "framework" },
        frontend: { framework: "framework" },
        mobile: { framework: "framework" },
      },
      typescript: "typescript",
      builder: "builder",
      test: "test",
      lint: "lint",
      orm: "orm",
      git: "git",
      cicd: "cicd",
      deploy: "deploy",
      docker: "docker",
    },
  },
  system: {
    type: {
      monorepo: "monorepo",
      shared: "shared",
    },
    option: {
      category: {
        type: "type",
        compulsory: "compulsory",
        optional: "optional",
      },
    },
  },
} as const;

const sysConfKey = {
  npm: "npm",
  type: "type",
  monorepo: "monorepo",
} as const;

type TypeOptionObj = typeof meta.plugin.option.type;
type NonTypeOption = Exclude<keyof typeof meta.plugin.option, "type">;
type CommonTypeOption = keyof TypeOptionObj["common"];
type TypeWithOption = Exclude<keyof TypeOptionObj, "common">;
export type PluginType = keyof typeof meta.plugin.type;
export type ConfType = PluginType | "monorepo";
export enum NPM {
  npm = "npm",
  pnpm = "pnpm",
}
export type Conf = {
  npm: NPM;
  type: string;
  monorepo?: { name: string; types: string[] };
} & {
  [K in PluginType]?: { [K0 in CommonTypeOption]?: string } & {
    -readonly [K0 in keyof TypeOptionObj[K extends TypeWithOption
      ? K
      : never]]?: string;
  } & Partial<Record<string, string | string[]>>;
} & {
  [K in NonTypeOption]?: string;
} & Partial<Record<string, string | string[]>>;

export type Category = keyof typeof meta.system.option.category;

export type Spinner = {
  start: (msg?: string) => void;
  stop: (msg?: string, code?: number) => void;
};

export interface IPlugin {
  run: (conf: Conf, s: Spinner) => Promise<void>;
}
export type Value = {
  name: string;
  label: string;
  plugin?: IPlugin;
  disables: {
    type?: string;
    option: string;
  }[];
  enables: {
    type?: string;
    option: string;
  }[];
};
export type Option = {
  name: string;
  label: string;
  plugin?: IPlugin;
  values: Value[];
  multiple?: boolean;
  optional?: boolean;
  initial?: string;
  disabled?: boolean;
};
export type Type = Value & { options: Option[] };
export const options: {
  type: Type[];
  compulsory: Option[];
  optional: Option[];
} = { type: [], compulsory: [], optional: [] };

export const regType = (type: Type) => {
  if (Object.keys(meta.system.type).includes(type.name)) {
    throw new Error(message.sysType);
  }
  if (options.type.find((e) => e.name === type.name)) {
    throw new Error(message.typeExist);
  }
  options.type.push(type);
};

export const useType = (name: string, label: string) => {
  if (Object.keys(meta.system.type).includes(name)) {
    throw new Error(message.sysType);
  }
  if (!options.type.find((e) => e.name === name)) {
    options.type.push({ name, label, options: [], disables: [], enables: [] });
  }
};

export const regOption = (
  option: Option,
  category: Category,
  type?: string,
) => {
  const opts = getOptions(category, type, option.name);
  if (opts.find((e) => e.name === option.name)) {
    throw new Error(message.optionExist);
  }
  opts.push(option);
};

export const useOption = (
  name: string,
  label: string,
  category: Category,
  type?: string,
  multiple?: boolean,
  optional?: boolean,
  initial?: string,
) => {
  const opts = getOptions(category, type, name);
  if (!opts.find((e) => e.name === name)) {
    opts.push({ name, label, values: [], multiple, optional, initial });
  }
};

export const regValue = (
  value: Value,
  option: string,
  type?: string,
  index?: number,
) => {
  const opt = getOption(option, type);
  if (opt.values.find((e) => e.name === value.name)) {
    throw new Error(message.valueExist);
  }
  if (index === undefined) {
    opt.values.push(value);
    return;
  }
  opt.values.splice(index, 0, value);
};

export const disableOptions = (value: Value) => {
  for (const { option, type } of value.disables) {
    if (value.enables.find((e) => e.option === option)?.type === type) {
      continue;
    }
    const opt = getOption(option, type);
    opt.disabled = true;
  }
};

const getOptions = (category: Category, type?: string, option?: string) => {
  if (category === meta.system.option.category.type) {
    if (!type) {
      throw new Error(message.typeRequired);
    }
    const type0 = options.type.find((e) => e.name === type);
    if (!type0) {
      throw new Error(message.typeNotExist);
    }
    return type0.options;
  }
  if (!option) {
    throw new Error(message.optionRequired);
  }
  if (Object.keys(sysConfKey).includes(option)) {
    throw new Error(message.sysConfKey);
  }
  if (
    (category === meta.system.option.category.compulsory &&
      options.optional.find((e) => e.name === option)) ||
    (category === meta.system.option.category.optional &&
      options.compulsory.find((e) => e.name === option))
  ) {
    throw new Error(message.optionConflict);
  }
  return options[category];
};

const getOption = (name: string, type?: string) => {
  let opts;
  if (!type) {
    opts = [...options.compulsory, ...options.optional];
  } else {
    const type0 = options.type.find((e) => e.name === type);
    if (!type0) {
      throw new Error(message.typeNotExist);
    }
    opts = type0.options;
  }
  const option = opts.find((e) => e.name === name);
  if (!option) {
    throw new Error(message.optionNotExist);
  }
  return option;
};
