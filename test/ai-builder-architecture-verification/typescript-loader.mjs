import { readFile } from "node:fs/promises";
import ts from "typescript";
import { resolve as resolveAliases } from "../node-alias-loader.mjs";

export const resolve = resolveAliases;

export async function load(url, context, nextLoad) {
  if (!url.startsWith("file:") || (!url.endsWith(".ts") && !url.endsWith(".tsx"))) {
    return nextLoad(url, context);
  }
  const source = await readFile(new URL(url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: true,
    },
    fileName: new URL(url).pathname,
  });
  return { format: "module", shortCircuit: true, source: output.outputText };
}
