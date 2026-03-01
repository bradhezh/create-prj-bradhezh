import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { main } from "@/main";

// eslint-disable-next-line @typescript-eslint/no-implied-eval
const dynamicImport = new Function("specifier", "return import(specifier)");

void (async () => {
  const dir = join(__dirname, "plugins");
  for (const file of (await readdir(dir)).filter((e) => e.endsWith(".js"))) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await dynamicImport(pathToFileURL(join(dir, file)).href);
  }
  await main();
})();
