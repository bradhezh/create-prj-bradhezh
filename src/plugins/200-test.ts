import { regOption, meta, PosMode } from "@/registry";

regOption(
  {
    name: meta.plugin.option.test,
    label: "Test framework",
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
  meta.system.option.category.optional,
);
