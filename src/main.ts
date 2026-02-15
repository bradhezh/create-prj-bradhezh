import { readdir } from "node:fs/promises";
import { log } from "@clack/prompts";

import { config, plugins } from "@/conf";
import { message } from "@/message";

export const main = async () => {
  try {
    if ((await readdir(process.cwd())).length) {
      log.error(message.cwdNonEmpty);
      return;
    }
    const conf = await config();
    for (const plugin of plugins) {
      await plugin.run(conf);
    }
  } catch (err: any) {
    console.log(err.response?.data?.message || err.message || err);
    console.log(err.stack);
    process.exit(1);
  }
};
