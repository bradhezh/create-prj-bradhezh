import { message } from "@/message";

export const meta = {
  plugin: {
    type: {
      backend: "backend",
      frontend: "frontend",
      mobile: "mobile",
      node: "node",
      cli: "cli",
      lib: "lib",
      monorepo: "monorepo",
    },
    option: {
      type: {
        name: "name",
        framework: "framework",
        typescript: "typescript",
        deployment: "deployment",
      },
      builder: "builder",
      test: "test",
      lint: "lint",
      git: "git",
      cicd: "cicd",
      orm: "orm",
    },
    value: { none: "none" },
  },
  system: {
    type: { shared: "shared" },
    option: {
      category: {
        type: "type",
        compulsory: "compulsory",
        optional: "optional",
      },
    },
  },
} as const;

const sysConfKey = { npm: "npm", type: "type" } as const;

type TypeOption = keyof typeof meta.plugin.option.type;
type NonTypeOption = Exclude<keyof typeof meta.plugin.option, "type">;
export type PluginType = keyof typeof meta.plugin.type;
export type PrimeType = Exclude<PluginType, "monorepo">;
export enum NPM {
  npm = "npm",
  pnpm = "pnpm",
}
export type Conf = {
  npm: NPM;
  type: string;
  monorepo?: { name: string; types: string[] };
} & Partial<
  Record<
    PrimeType,
    Partial<Record<TypeOption, string>> &
      Partial<Record<string, string | string[]>>
  >
> &
  Partial<Record<NonTypeOption, string>> &
  Partial<Record<string, string | string[]>>;

export type Category = keyof typeof meta.system.option.category;

export enum PosMode {
  first = "first",
  last = "last",
  after = "after",
}
type Pos = { mode: PosMode; refs?: string[] };
type QueueElem = { name: string; label: string; pos?: Pos };
export type Plugin = QueueElem & { run: (conf: Conf) => Promise<void> };
export type Value = QueueElem & {
  skips: { option: string; type?: string }[];
  keeps: { option: string; type?: string }[];
  requires: { option: string; type?: string }[];
  plugin?: Plugin;
};
export type Option = QueueElem & {
  plugin?: Plugin;
  values: Value[];
  multiple?: boolean;
  optional?: boolean;
  initial?: string;
  disabled?: boolean;
  required?: boolean;
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
  addInQueue(options.type, type);
};

export const regOption = (
  option: Option,
  category: Category,
  type?: string,
) => {
  const opts = getOptionsForReg(option.name, category, type);
  addInQueue(opts, option);
};

export const regValue = (value: Value, option: string, type?: string) => {
  const opt = getOption(option, type);
  addInQueue(opt.values, value);
};

export const addInQueue = (queue: QueueElem[], elem: QueueElem) => {
  if (queue.find((e) => e.name === elem.name)) {
    throw new Error(message.elemExist);
  }
  if (elem.pos?.mode === PosMode.after && !elem.pos.refs) {
    throw new Error(message.refsRequired);
  }
  queue.splice(
    elem.pos?.mode === PosMode.first
      ? 0
      : elem.pos?.mode !== PosMode.last &&
          queue.at(-1)?.pos?.mode === PosMode.last
        ? queue.length - 1
        : queue.length,
    0,
    elem,
  );
  reSort(queue, elem);
};

export const adjustOptions = (conf: Conf, value: Value) => {
  for (const { option, type } of value.skips) {
    if (
      keptOrRequiredInTypes(conf, option, type) ||
      keptOrRequiredInOptions(conf, option, type, [
        ...options.compulsory,
        ...options.optional,
      ])
    ) {
      continue;
    }
    const opt = getOption(option, type);
    opt.disabled = true;
  }
  for (const { option, type } of value.keeps) {
    const opt = getOption(option, type);
    opt.disabled = false;
  }
  for (const { option, type } of value.requires) {
    const opt = getOption(option, type);
    opt.disabled = false;
    opt.required = true;
  }
};

export const typeFrmwksSkip = (option: string) => {
  return [
    ...options.type
      .filter((type) => type.skips.find((e) => e.option === option && !e.type))
      .map((type) => type.name),
    ...options.type
      .map((type) => type.options)
      .flat()
      .filter((opt) => opt.name === meta.plugin.option.type.framework)
      .map((opt) => opt.values)
      .flat()
      .filter((v) => v.skips.find((e) => e.option === option && !e.type))
      .map((v) => v.name),
  ];
};

const getOptionsForReg = (
  option: string,
  category: Category,
  type?: string,
) => {
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
  if (Object.keys(sysConfKey).includes(option)) {
    throw new Error(message.sysConfKey);
  }
  if (
    options.type.find((e) => e.name === option) ||
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

const reSort = (queue: QueueElem[], elem: QueueElem, seen = new Set()) => {
  if (seen.has(elem.name)) {
    throw new Error(message.circularDep);
  }
  seen.add(elem.name);
  const index = queue.findIndex((e) => e.name === elem.name);
  for (let i = index; ; --i) {
    const found = queue.findIndex(
      (e) =>
        e.pos?.mode === PosMode.after &&
        e.pos.refs!.find((e) => elem.name.startsWith(e)),
    );
    if (found === -1 || found >= i) {
      break;
    }
    if (elem.pos?.mode === PosMode.last) {
      throw new Error(message.afterLast);
    }
    const [move] = queue.splice(found, 1);
    queue.splice(index, 0, move);
    reSort(queue, move, new Set(seen));
  }
};

const keptOrRequiredInTypes = (conf: Conf, option: string, type?: string) => {
  const types = [conf.type, ...(conf.monorepo?.types ?? [])];
  const types0 = options.type.filter((type0) => types.includes(type0.name));
  return (
    types0.find(
      (type0) =>
        type0.keeps.find((e) => e.option === option && e.type === type) ||
        type0.requires.find((e) => e.option === option && e.type === type),
    ) ||
    types0.find((type0) =>
      keptOrRequiredInOptions(conf, option, type, type0.options, type0.name),
    )
  );
};

const keptOrRequiredInOptions = (
  conf: Conf,
  option: string,
  type: string | undefined,
  opts: Option[],
  ofType?: string,
) => {
  const optConf = !ofType ? conf : conf[ofType];
  if (!optConf || typeof optConf !== "object" || Array.isArray(optConf)) {
    return false;
  }
  return opts.find((opt) => {
    const value =
      opt.name in optConf &&
      opt.values.find((v) => v.name === optConf[opt.name]);
    return (
      value &&
      (value.keeps.find((e) => e.option === option && e.type === type) ||
        value.requires.find((e) => e.option === option && e.type === type))
    );
  });
};
