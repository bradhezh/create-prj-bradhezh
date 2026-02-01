import { option } from "./const";
import { regOption, meta, PosMode } from "@/registry";

regOption(
  {
    name: option.reactDeploy,
    label: "React deployment",
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
  meta.plugin.type.frontend,
);
