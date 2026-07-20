import { existsSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function resolveTypeScript(base) {
  return [base, `${base}.ts`, `${base}.tsx`, resolvePath(base, "index.ts")]
    .find((candidate) => existsSync(candidate));
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { shortCircuit: true, url: "data:text/javascript," };
  if (specifier === "@/app/lib/auth/clerk") return { shortCircuit: true, url: "data:text/javascript,export const requireClerkIdentity=async()=>{throw new Error('test stub')};export const requireClerkUserId=async()=>{throw new Error('test stub')};" };
  if (specifier.startsWith("@/")) {
    const file = resolveTypeScript(resolvePath(process.cwd(), specifier.slice(2)));
    if (file) return { shortCircuit: true, url: pathToFileURL(file).href };
  }
  if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    const file = resolveTypeScript(resolvePath(dirname(fileURLToPath(context.parentURL)), specifier));
    if (file) return { shortCircuit: true, url: pathToFileURL(file).href };
  }
  return nextResolve(specifier, context);
}
