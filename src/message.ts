export const message = {
  validate: "Option required.",
  type: { label: "Project type" },
  monorepo: {
    name: { label: "Monorepo name" },
    types: { label: "Types in monorepo" },
  },
  optional: {
    options: {
      hint: "Optional options: %s",
      label: "Configure them one by one, or choose none of them?",
    },
    defaults: {
      hint: "Defaults for optional options: %s",
      label:
        "Accept defaults, or configure them one by one, or choose none of them?",
    },
  },
  sysType: "Type cannot be registered with a system name.",
  typeExist: "Type exists already.",
  typeNotExist: "Type does not exist.",
  typeRequired: "Type must be specified for type options.",
  sysConfKey: "Option cannot be registered with a system name.",
  optionExist: "Option exists already.",
  optionNotExist: "Option does not exist.",
  optionRequired: "Option must be specified for non-type options.",
  optionConflict: "Option conflict between compulsory and optional ones.",
  valueExist: "Value exists already.",
  opCanceled: "Operation cancelled.",
  cwdNonEmpty: "Current work directory must be empty.",
  pmUnsupported: "Only npm or pnpm supported for now.",
  pnpmRequired: "Only pnpm supported for monorepo for now.",
  createPrj: "Creating projects",
  proceed: "Proceeding",
  prjCreated: "Creation completed!",
} as const;
