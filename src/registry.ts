import { message } from "@/message";

export const meta = {
  plugin: {
    type: {
      backend: "backend",
      frontend: "frontend",
      mobile: "mobile",
      node: "node",
      lib: "lib",
      cli: "cli",
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
      Partial<
        Record<
          string,
          string | string[] | Partial<Record<string, string | string[]>>
        >
      >
  >
> &
  Partial<Record<NonTypeOption, string>> &
  Partial<
    Record<
      string,
      string | string[] | Partial<Record<string, string | string[]>>
    >
  >;

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
  skips: { type?: string; option?: string; value?: string }[];
  keeps: { type?: string; option?: string; value?: string }[];
  requires: { option: string; type?: string }[];
  plugin?: Plugin;
  disabled?: boolean;
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
  if (
    [...type.skips, ...type.keeps].find(
      (e) => (!e.type && !e.option && !e.value) || (e.value && !e.option),
    )
  ) {
    throw new Error(message.invSkipOrKeep);
  }
  const type0 = { ...type, options: [] };
  addInQueue(options.type, type0);
  for (const option of type.options) {
    const opt = { ...option, values: [] };
    addInQueue(type0.options, opt);
    for (const value of option.values) {
      if (
        [...value.skips, ...value.keeps].find(
          (e) => (!e.type && !e.option && !e.value) || (e.value && !e.option),
        )
      ) {
        throw new Error(message.invSkipOrKeep);
      }
      addInQueue(opt.values, value);
    }
  }
};

export const regOption = (
  option: Option,
  category: Category,
  type?: string,
) => {
  if (category === meta.system.option.category.type && !type) {
    throw new Error(message.typeRequired);
  }
  const opts = getOptionsForReg(option.name, category, type);
  const opt = { ...option, values: [] };
  addInQueue(opts, opt);
  for (const value of option.values) {
    if (
      [...value.skips, ...value.keeps].find(
        (e) => (!e.type && !e.option && !e.value) || (e.value && !e.option),
      )
    ) {
      throw new Error(message.invSkipOrKeep);
    }
    addInQueue(opt.values, value);
  }
};

export const regValue = (value: Value, option: string, type?: string) => {
  if (
    [...value.skips, ...value.keeps].find(
      (e) => (!e.type && !e.option && !e.value) || (e.value && !e.option),
    )
  ) {
    throw new Error(message.invSkipOrKeep);
  }
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
  for (const { type, option, value: val } of value.skips) {
    if (
      keptOrRequiredInTypes(conf, type, option, val) ||
      keptOrRequiredInOptions(conf, type, option, val, [
        ...options.compulsory,
        ...options.optional,
      ])
    ) {
      continue;
    }
    getElem(type, option, val).disabled = true;
  }
  for (const { type, option, value: val } of value.keeps) {
    getElem(type, option, val).disabled = false;
  }
  for (const { option, type } of value.requires) {
    const opt = getOption(option, type);
    opt.disabled = false;
    opt.required = true;
    const val = opt.values.find((e) => e.name === meta.plugin.value.none);
    if (!val) {
      continue;
    }
    val.disabled = true;
  }
};

export const getElem = (
  type: string | undefined,
  option: string | undefined,
  value: string | undefined,
) => {
  if ((!type && !option && !value) || (value && !option)) {
    throw new Error();
  }
  if (!option) {
    const type0 = options.type.find((e) => e.name === type!);
    if (!type0) {
      throw new Error(message.typeNotExist);
    }
    return type0;
  }
  const opt = getOption(option, type);
  if (!value) {
    return opt;
  }
  const val = opt.values.find((e) => e.name === value);
  if (!val) {
    throw new Error(message.valueNotExist);
  }
  return val;
};

export const typeFrmwksSkip = (
  type: string | undefined,
  option: string | undefined,
  value: string | undefined,
) => {
  return [
    ...options.type
      .filter((type0) =>
        type0.skips.find(
          (e) => e.type === type && e.option === option && e.value === value,
        ),
      )
      .map((type0) => type0.name),
    ...options.type
      .map((type0) => type0.options)
      .flat()
      .filter((opt) => opt.name === meta.plugin.option.type.framework)
      .map((opt) => opt.values)
      .flat()
      .filter((val) =>
        val.skips.find(
          (e) => e.type === type && e.option === option && e.value === value,
        ),
      )
      .map((val) => val.name),
  ];
};

const getOptionsForReg = (
  option: string,
  category: Category,
  type: string | undefined,
) => {
  if (category === meta.system.option.category.type) {
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

const keptOrRequiredInTypes = (
  conf: Conf,
  type: string | undefined,
  option: string | undefined,
  value: string | undefined,
) => {
  const types = [conf.type, ...(conf.monorepo?.types ?? [])];
  const types0 = options.type.filter((type0) => types.includes(type0.name));
  return (
    types0.find(
      (type0) =>
        type0.keeps.find(
          (e) => e.type === type && e.option === option && e.value === value,
        ) || type0.requires.find((e) => e.type === type && e.option === option),
    ) ||
    types0.find((type0) =>
      keptOrRequiredInOptions(
        conf,
        type,
        option,
        value,
        type0.options,
        type0.name,
      ),
    )
  );
};

const keptOrRequiredInOptions = (
  conf: Conf,
  type: string | undefined,
  option: string | undefined,
  value: string | undefined,
  opts: Option[],
  ofType?: string,
) => {
  const optConf = !ofType ? conf : conf[ofType];
  if (!optConf || typeof optConf !== "object" || Array.isArray(optConf)) {
    return false;
  }
  return opts.find((opt) => {
    const val = opt.values.find((e) => e.name === optConf[opt.name]);
    return (
      val &&
      (val.keeps.find(
        (e) => e.type === type && e.option === option && e.value === value,
      ) ||
        val.requires.find((e) => e.type === type && e.option === option))
    );
  });
};
