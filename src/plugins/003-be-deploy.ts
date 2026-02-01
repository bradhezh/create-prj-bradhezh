import { option } from "./const";
import { regOption, meta, PosMode } from "@/registry";

regOption(
  {
    name: meta.plugin.option.type.deployment,
    label: "Backend deployment",
    values: [
      {
        name: meta.plugin.value.none,
        label: "None",
        pos: { mode: PosMode.last },
        skips: [{ option: option.deploySrc, type: meta.plugin.type.backend }],
        keeps: [],
        requires: [],
      },
    ],
  },
  meta.system.option.category.type,
  meta.plugin.type.backend,
);
