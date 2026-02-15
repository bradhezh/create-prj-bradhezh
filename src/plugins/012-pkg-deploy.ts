import { regOption, meta, PosMode } from "@/registry";

regOption(
  {
    name: meta.plugin.option.type.deployment,
    label: "Library publishing",
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
  meta.plugin.type.lib,
);
regOption(
  {
    name: meta.plugin.option.type.deployment,
    label: "CLI publishing",
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
  meta.plugin.type.cli,
);
