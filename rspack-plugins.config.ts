import { defineConfig } from "@rspack/cli";
import { ExternalItem } from "@rspack/core";
import nodeExternals from "webpack-node-externals";
import { TsCheckerRspackPlugin } from "ts-checker-rspack-plugin";
import { RunScriptWebpackPlugin } from "run-script-webpack-plugin";
import { join, basename } from "node:path";
import { readdirSync } from "node:fs";

const dev = process.env.NODE_ENV === "development";

export default defineConfig({
  target: "node",
  mode: !dev ? "production" : "development",

  entry: {
    ...Object.fromEntries(
      readdirSync(join(__dirname, "src", "plugins"))
        .filter((e) => e.endsWith(".ts") && e !== "const.ts")
        .map((e) => [
          join("plugins", basename(e, ".ts")),
          join(__dirname, "src", "plugins", e),
        ]),
    ),
  },

  resolve: {
    extensions: [".ts", "..."],
    tsConfig: join(__dirname, "tsconfig.json"),
  },

  externals: [
    nodeExternals() as ExternalItem,
    { "@/registry": "../registry.js" },
  ],
  externalsType: "commonjs",

  module: { rules: [{ test: /\.ts$/, use: { loader: "builtin:swc-loader" } }] },

  ...(!dev && { devTool: "nosources-source-map" }),

  devServer: { devMiddleware: { writeToDisk: true } },

  plugins: [
    new TsCheckerRspackPlugin(),
    dev && new RunScriptWebpackPlugin({ name: "index.js" }),
  ].filter(Boolean),
});
