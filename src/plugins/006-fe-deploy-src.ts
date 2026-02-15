import { option } from "./const";
import { regOption, meta } from "@/registry";

regOption(
  { name: option.deploySrc, label: "Frontend deployment source", values: [] },
  meta.system.option.category.type,
  meta.plugin.type.frontend,
);
