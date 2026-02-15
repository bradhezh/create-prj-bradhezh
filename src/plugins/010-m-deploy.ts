import { regOption, meta, PosMode } from "@/registry";

regOption(
  {
    name: meta.plugin.option.type.deployment,
    label: "Mobile deployment",
    values: [
      {
        name: meta.plugin.value.none,
        label: "None",
        pos: { mode: PosMode.last },
        skips: [],
        keeps: [],
        requires: [],
      },
    ],
  },
  meta.system.option.category.type,
  meta.plugin.type.mobile,
);
