import { regOption, meta } from "@/registry";

regOption(
  {
    name: meta.plugin.option.lint,
    label: "Lint",
    values: [
      {
        name: meta.plugin.value.none,
        label: "None",
        disables: [],
        enables: [],
      },
    ],
  },
  meta.system.option.category.optional,
);
