import { readFile } from "node:fs/promises";
import ts from "typescript";
import { resolve as resolveAliases } from "../node-alias-loader.mjs";

export function resolve(specifier, context, nextResolve) {
  if (specifier === "@/app/lib/auth/clerk") {
    return { shortCircuit: true, url: "data:text/javascript,export const requireClerkUserId=async()=>\"architecture-verification-user\";export const requireClerkIdentity=async()=>({userId:\"architecture-verification-user\",displayName:\"Verification User\",email:\"verification@example.test\"});" };
  }
  return resolveAliases(specifier, context, nextResolve);
}

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
