export const message = {
  validate: "Option required.",
  type: { label: "Project type" },
  monorepo: {
    name: { label: "Monorepo name" },
    types: { label: "Types in monorepo" },
  },
  optional: {
    hint: "Optional options: %s",
    options: {
      label:
        "Configure them one by one, or choose none of them (except required ones)?",
    },
    defaults: {
      label:
        "Accept defaults, or configure them one by one, or choose none of them (except required ones)?",
    },
  },
  opCanceled: "Operation cancelled.",
  cwdNonEmpty: "Current work directory must be empty.",
  pmUnsupported: "Only npm or pnpm supported for now.",
  pnpmRequired: "Only pnpm supported for monorepo for now.",
  elemExist: "Element exists already.",
  refsRequired: 'When using "after", reference elements must be specified.',
  circularDep: "Circular dependency.",
  afterLast: "Element cannot be after ones as the last.",
  sysType: "Type cannot be registered with a system name.",
  typeNotExist: "Type does not exist.",
  typeRequired: "Type must be specified for type options.",
  sysConfKey: "Option cannot be registered with a system name.",
  optionNotExist: "Option does not exist.",
  optionConflict: "Option conflict between compulsory and optional ones.",
  invFormat: "Invalid format of %s.",
  pluginStart: "Configuring %s",
  setPkg: "Setting packages",
  setWkspace: "Setting workspace",
  setShared: "Setting shared",
  pluginFinish: "%s completed!",
  noteWidth: 70,
} as const;
