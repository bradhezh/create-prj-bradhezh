import { regOption, meta } from "@/registry";

regOption(
  { name: meta.plugin.option.builder, label: "Builder", values: [] },
  meta.system.option.category.compulsory,
);
