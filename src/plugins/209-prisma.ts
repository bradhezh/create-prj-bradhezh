import { log, spinner } from "@clack/prompts";
import { format } from "node:util";

import { value } from "./const";
import { regValue, meta, Conf, Plugin } from "@/registry";
import { message } from "@/message";

async function run(this: Plugin, conf: Conf) {
  const s = spinner();
  s.start();
  log.info(format(message.pluginStart, this.label));

  //const { } = await parseConf(conf);

  await Promise.resolve(conf);
  conf[value.orm.prisma] = {};

  log.info(format(message.pluginFinish, this.label));
  s.stop();
}

const label = "Prisma" as const;

regValue(
  {
    name: value.orm.prisma,
    label,
    skips: [],
    keeps: [],
    requires: [],
    plugin: {
      name: `${meta.plugin.option.orm}_${value.orm.prisma}`,
      label,
      run,
    },
  },
  meta.plugin.option.orm,
);
