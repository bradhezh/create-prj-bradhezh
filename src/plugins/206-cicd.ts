import { regOption, meta, PosMode } from "@/registry";

regOption(
  {
    name: meta.plugin.option.cicd,
    label: "CI/CD",
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
