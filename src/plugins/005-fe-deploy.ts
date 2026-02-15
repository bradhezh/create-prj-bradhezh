import { option } from "./const";
import { regOption, meta, PosMode } from "@/registry";

regOption(
  {
    name: meta.plugin.option.type.deployment,
    label: "Frontend deployment",
    values: [
      {
        name: meta.plugin.value.none,
        label: "None",
        pos: { mode: PosMode.last },
        skips: [{ type: meta.plugin.type.frontend, option: option.deploySrc }],
        keeps: [],
        requires: [],
      },
    ],
  },
  meta.system.option.category.type,
  meta.plugin.type.frontend,
);
