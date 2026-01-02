import { readdir } from "node:fs/promises";
import p from "@clack/prompts";

import { message } from "@/conf";
import { confFromUser } from "@/prompt";
import { create } from "@/create";

void (async () => {
  if ((await readdir(process.cwd())).length) {
    p.log.error(message.cwdNonEmpty);
    return;
  }
  const conf = await confFromUser();
  const s = p.spinner();
  s.start(message.createPrj);
  await create(conf, s);
  s.stop(message.prjCreated);
})();
