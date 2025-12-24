import { confFromUser } from "@/prompt";
import { createDir, createPkg } from "@/create";

(async () => {
  const conf = await confFromUser();
  createDir(conf);
  await createPkg(conf);
})();
