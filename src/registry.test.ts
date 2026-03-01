import { message } from "@/message";
import {
  addInQueue,
  regType,
  regOption,
  regValue,
  getElem,
  adjustOptions,
  typeFrmwksSkip,
  options,
  meta,
  PosMode,
  NPM,
  Conf,
  Value,
  Option,
  Type,
} from "@/registry";

describe("registry", () => {
  beforeEach(() => {
    options.type.length = 0;
    options.compulsory.length = 0;
    options.optional.length = 0;
  });

  describe("addInQueue", () => {
    it("should add element to empty queue", () => {
      const queue: Value[] = [];
      addInQueue(queue, { name: "test", label: "" });
      expect(queue).toHaveLength(1);
      expect(queue[0].name).toBe("test");
    });

    it("should throw if element already exists", () => {
      expect(() =>
        addInQueue([{ name: "test", label: "" }], { name: "test", label: "" }),
      ).toThrow(message.elemExist);
    });

    it("should add element at end by default", () => {
      const queue: Option[] = [
        { name: "a", label: "", values: [] },
        { name: "b", label: "", values: [] },
      ];
      addInQueue(queue, { name: "c", label: "" });
      expect(queue).toHaveLength(3);
      expect(queue[0].name).toBe("a");
      expect(queue[1].name).toBe("b");
      expect(queue[2].name).toBe("c");
    });

    it("should add element at first position", () => {
      const queue: Type[] = [
        {
          name: "a",
          label: "",
          skips: [],
          keeps: [],
          requires: [],
          options: [],
        },
        {
          name: "b",
          label: "",
          skips: [],
          keeps: [],
          requires: [],
          options: [],
        },
      ];
      addInQueue(queue, { name: "c", label: "", pos: { mode: PosMode.first } });
      expect(queue).toHaveLength(3);
      expect(queue[0].name).toBe("c");
      expect(queue[1].name).toBe("a");
      expect(queue[2].name).toBe("b");
    });

    it("should add element before last position", () => {
      const queue: Option[] = [
        { name: "a", label: "", values: [] },
        { name: "b", label: "", values: [], pos: { mode: PosMode.last } },
      ];
      addInQueue(queue, { name: "c", label: "" });
      expect(queue).toHaveLength(3);
      expect(queue[0].name).toBe("a");
      expect(queue[1].name).toBe("c");
      expect(queue[2].name).toBe("b");
    });

    it("should add element at last position", () => {
      const queue: Option[] = [
        { name: "a", label: "", values: [] },
        { name: "b", label: "", values: [], pos: { mode: PosMode.last } },
      ];
      addInQueue(queue, { name: "c", label: "", pos: { mode: PosMode.last } });
      expect(queue).toHaveLength(3);
      expect(queue[0].name).toBe("a");
      expect(queue[1].name).toBe("b");
      expect(queue[2].name).toBe("c");
    });

    it("should throw if after mode without refs", () => {
      expect(() =>
        addInQueue([], {
          name: "test",
          label: "",
          pos: { mode: PosMode.after },
        }),
      ).toThrow(message.refsRequired);
    });

    it("should move element after referenced elements via reSort", () => {
      const queue: Option[] = [
        {
          name: "a",
          label: "",
          values: [],
          pos: { mode: PosMode.after, refs: ["c", "d"] },
        },
        { name: "b", label: "", values: [] },
      ];
      addInQueue(queue, { name: "c", label: "" });
      addInQueue(queue, { name: "d_1", label: "" });
      addInQueue(queue, { name: "d_2", label: "" });
      expect(queue).toHaveLength(5);
      expect(queue[0].name).toBe("b");
      expect(queue[1].name).toBe("c");
      expect(queue[2].name).toBe("d_1");
      expect(queue[3].name).toBe("d_2");
      expect(queue[4].name).toBe("a");
    });

    it("should move elements recursively via reSort", () => {
      const queue: Option[] = [
        {
          name: "a",
          label: "",
          values: [],
          pos: { mode: PosMode.after, refs: ["d"] },
        },
        {
          name: "b",
          label: "",
          values: [],
          pos: { mode: PosMode.after, refs: ["a"] },
        },
        {
          name: "c",
          label: "",
          values: [],
          pos: { mode: PosMode.after, refs: ["b"] },
        },
      ];
      addInQueue(queue, { name: "d", label: "" });
      expect(queue).toHaveLength(4);
      expect(queue[0].name).toBe("d");
      expect(queue[1].name).toBe("a");
      expect(queue[2].name).toBe("b");
      expect(queue[3].name).toBe("c");
    });

    it("should throw on circular dependency in reSort", () => {
      expect(() =>
        addInQueue(
          [{ name: "a", label: "", pos: { mode: PosMode.after, refs: ["b"] } }],
          { name: "b", label: "", pos: { mode: PosMode.after, refs: ["a"] } },
        ),
      ).toThrow(message.circularDep);
    });

    it("should throw if after last element", () => {
      expect(() =>
        addInQueue(
          [
            { name: "a", label: "" },
            { name: "b", label: "", pos: { mode: PosMode.after, refs: ["a"] } },
          ],
          { name: "a_", label: "", pos: { mode: PosMode.last } },
        ),
      ).toThrow(message.afterLast);
    });
  });

  describe("regType", () => {
    it("should register types with options and values", () => {
      const a = {
        name: "a",
        label: "",
        pos: { mode: PosMode.last },
        skips: [],
        keeps: [],
        requires: [],
        options: [
          {
            name: "a",
            label: "",
            pos: { mode: PosMode.after, refs: ["b"] },
            values: [
              {
                name: "a",
                label: "",
                skips: [],
                keeps: [],
                requires: [],
              },
              {
                name: "b",
                label: "",
                pos: { mode: PosMode.first },
                skips: [],
                keeps: [],
                requires: [],
              },
            ],
          },
          { name: "b", label: "", values: [] },
        ],
      };
      const b = {
        name: "b",
        label: "",
        skips: [],
        keeps: [],
        requires: [],
        options: [],
      };
      regType(a);
      regType(b);
      expect(options.type).toHaveLength(2);
      expect(options.type[0].name).toBe("b");
      expect(options.type[1].name).toBe("a");
      expect(options.type[1].options).toHaveLength(2);
      expect(options.type[1].options[0].name).toBe("b");
      expect(options.type[1].options[1].name).toBe("a");
      expect(options.type[1].options[1].values).toHaveLength(2);
      expect(options.type[1].options[1].values[0].name).toBe("b");
      expect(options.type[1].options[1].values[1].name).toBe("a");
    });

    it("should throw if registering system type", () => {
      const type: Type = {
        name: meta.system.type.shared,
        label: "",
        skips: [],
        keeps: [],
        requires: [],
        options: [],
      };
      expect(() => regType(type)).toThrow(message.sysType);
    });

    it("should throw on invalid skips/keeps", () => {
      const type: Type = {
        name: "test",
        label: "",
        skips: [{ value: "" }],
        keeps: [],
        requires: [],
        options: [],
      };
      expect(() => regType(type)).toThrow(message.invSkipOrKeep);
    });
  });

  describe("getElem", () => {
    beforeEach(() => {
      regType({
        name: "backend",
        label: "",
        skips: [],
        keeps: [],
        requires: [],
        options: [
          {
            name: "framework",
            label: "",
            values: [
              {
                name: "express",
                label: "",
                skips: [],
                keeps: [],
                requires: [],
              },
            ],
          },
        ],
      });
      regOption(
        { name: "builder", label: "", values: [] },
        meta.system.option.category.compulsory,
      );
      regValue(
        { name: "rspack", label: "", skips: [], keeps: [], requires: [] },
        "builder",
      );
    });

    it("should get type by name", () => {
      const type = getElem("backend", undefined, undefined);
      expect(type.name).toBe("backend");
    });

    it("should get option by name", () => {
      const option = getElem("backend", "framework", undefined);
      expect(option.name).toBe("framework");
      const opt = getElem(undefined, "builder", undefined);
      expect(opt.name).toBe("builder");
    });

    it("should get value by name", () => {
      const value = getElem("backend", "framework", "express");
      expect(value.name).toBe("express");
      const val = getElem(undefined, "builder", "rspack");
      expect(val.name).toBe("rspack");
    });

    it("should throw if invalid or not found", () => {
      expect(() => getElem(undefined, undefined, undefined)).toThrow(
        message.invElem,
      );
      expect(() => getElem("backend", undefined, "express")).toThrow(
        message.invElem,
      );
      expect(() => getElem(undefined, undefined, "rspack")).toThrow(
        message.invElem,
      );
      expect(() => getElem("nonexistent", undefined, undefined)).toThrow(
        message.typeNotExist,
      );
      expect(() => getElem(undefined, "nonexistent", undefined)).toThrow(
        message.optionNotExist,
      );
      expect(() => getElem(undefined, "builder", "nonexistent")).toThrow(
        message.valueNotExist,
      );
    });
  });

  describe("skips/keeps/requires", () => {
    let backend: Type;
    let beRender: Value;
    let react: Value;
    let next: Value;
    let feDeploy: Option;
    let feRender: Value;
    let builder: Option;
    let git: Option;
    let gitNone: Value;

    beforeEach(() => {
      regType({
        name: "backend",
        label: "",
        skips: [],
        keeps: [{ option: "builder" }],
        requires: [{ option: "git" }],
        options: [
          {
            name: "deployment",
            label: "",
            values: [
              {
                name: "render",
                label: "",
                skips: [{ type: "frontend", option: "deployment" }],
                keeps: [],
                requires: [],
              },
            ],
          },
        ],
      });
      regType({
        name: "frontend",
        label: "",
        skips: [],
        keeps: [],
        requires: [],
        options: [
          {
            name: "framework",
            label: "",
            values: [
              {
                name: "react",
                label: "",
                skips: [{ option: "builder" }],
                keeps: [],
                requires: [],
              },
              {
                name: "next",
                label: "",
                skips: [
                  { type: "frontend", option: "deployment", value: "render" },
                  { option: "builder" },
                ],
                keeps: [{ type: "frontend", option: "deployment" }],
                requires: [],
              },
            ],
          },
          {
            name: "deployment",
            label: "",
            values: [
              { name: "render", label: "", skips: [], keeps: [], requires: [] },
              { name: "vercel", label: "", skips: [], keeps: [], requires: [] },
            ],
          },
        ],
      });
      regOption(
        { name: "builder", label: "", values: [] },
        meta.system.option.category.compulsory,
      );
      regOption(
        {
          name: "git",
          label: "",
          values: [
            { name: "github", label: "", skips: [], keeps: [], requires: [] },
            {
              name: meta.plugin.value.none,
              label: "",
              skips: [],
              keeps: [],
              requires: [],
            },
          ],
        },
        meta.system.option.category.optional,
      );
      backend = getElem("backend", undefined, undefined) as Type;
      beRender = getElem("backend", "deployment", "render") as Value;
      react = getElem("frontend", "framework", "react") as Value;
      next = getElem("frontend", "framework", "next") as Value;
      feDeploy = getElem("frontend", "deployment", undefined) as Option;
      feRender = getElem("frontend", "deployment", "render") as Value;
      builder = getElem(undefined, "builder", undefined) as Option;
      git = getElem(undefined, "git", undefined) as Option;
      gitNone = getElem(undefined, "git", meta.plugin.value.none) as Value;
    });

    it("adjustOptions", () => {
      const conf: Conf = {
        npm: NPM.pnpm,
        type: "monorepo",
        monorepo: { name: "", types: ["frontend"] },
      };
      expect(builder.disabled).toBe(undefined);
      conf.frontend = { name: "frontend", framework: "react" };
      adjustOptions(conf, react);
      expect(builder.disabled).toBe(true);

      expect(git.disabled).toBe(undefined);
      expect(git.required).toBe(undefined);
      conf.monorepo!.types.push("backend");
      adjustOptions(conf, backend);
      expect(builder.disabled).toBe(false);
      expect(git.disabled).toBe(false);
      expect(git.required).toBe(true);
      expect(gitNone.disabled).toBe(true);

      builder.disabled = undefined;
      adjustOptions(conf, react);
      expect(builder.disabled).toBe(undefined);

      expect(feDeploy.disabled).toBe(undefined);
      conf.backend = { name: "backend", deployment: "render" };
      adjustOptions(conf, beRender);
      expect(feDeploy.disabled).toBe(true);

      expect(feRender.disabled).toBe(undefined);
      conf.frontend = { name: "frontend", framework: "next" };
      adjustOptions(conf, next);
      expect(feDeploy.disabled).toBe(false);
      expect(feRender.disabled).toBe(true);
    });

    it("typeFrmwksSkip", () => {
      const typeFrmwks = typeFrmwksSkip(undefined, "builder", undefined);
      expect(typeFrmwks).toHaveLength(2);
      expect(typeFrmwks).toContain("react");
      expect(typeFrmwks).toContain("next");
    });
  });
});
