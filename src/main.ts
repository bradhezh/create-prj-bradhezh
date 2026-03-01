import { readdir } from "node:fs/promises";
import { log } from "@clack/prompts";
import { isAxiosError } from "axios";

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
  } catch (err: unknown) {
    if (!(err instanceof Error)) {
      console.log(err);
      process.exit(1);
    }
    if (isAxiosError(err)) {
      const data = err.response?.data as { message?: string } | undefined;
      console.log(data?.message || err.message);
    } else {
      console.log(err.message);
    }
    console.log(err.stack);
    process.exit(1);
  }
};
