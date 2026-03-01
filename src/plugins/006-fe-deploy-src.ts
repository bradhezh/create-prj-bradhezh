import { option, value } from "./const";
import { regOption, meta } from "@/registry";

regOption(
  {
    name: option.deploySrc,
    label: "Frontend deployment source",
    values: [
      {
        name: value.deploySrc.repo,
        label:
          "Repository\n|    Note: Extra authentication might be needed, e.g. for private repositories\n|    on GitHub to be deployed on Render.com, you should install Render Github\n|    App. You can install it on Render's dashboard, or via\n|    https://github.com/apps/render/installations/new.",
        skips: [],
        keeps: [],
        requires: [{ option: meta.plugin.option.git }],
      },
    ],
  },
  meta.system.option.category.type,
  meta.plugin.type.frontend,
);
