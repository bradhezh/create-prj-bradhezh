import { log, spinner } from "@clack/prompts";
import { format } from "node:util";

import { value } from "./const";
import { regValue, meta, Conf, Plugin } from "@/registry";
import { message } from "@/message";

async function run(this: Plugin, _conf: Conf) {
  const s = spinner();
  s.start();
  log.info(format(message.pluginStart, this.label));

  await Promise.resolve();

  log.info(format(message.pluginFinish, this.label));
  s.stop();
}

const label = "GitHub Actions" as const;

regValue(
  {
    name: value.cicd.ghaction,
    label,
    skips: [],
    keeps: [],
    requires: [],
    plugin: {
      name: `${meta.plugin.option.cicd}_${value.cicd.ghaction}`,
      label,
      run,
    },
  },
  meta.plugin.option.cicd,
);
