import { option, value } from "./const";
import { regOption, meta } from "@/registry";

regOption(
  {
    name: meta.plugin.option.git,
    label: "Git",
    values: [
      {
        name: value.git.none,
        label: "None",
        disables: [
          { option: option.gitVis },
          /*
          { option: meta.plugin.option.cicd },
          { option: meta.plugin.option.deploy },
          { option: meta.plugin.option.docker },
          */
        ],
        enables: [],
      },
    ],
  },
  meta.system.option.category.optional,
);
regOption(
  {
    name: option.gitVis,
    label: "Git repository visibility",
    values: [
      { name: value.gitVis.public, label: "Public", disables: [], enables: [] },
      {
        name: value.gitVis.private,
        label: "Private",
        disables: [],
        enables: [],
      },
    ],
  },
  meta.system.option.category.optional,
);
