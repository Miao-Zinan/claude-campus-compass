// Resolves the project's "@/..." alias and extensionless TypeScript imports
// so offline tests can run with Node's built-in type stripping and test runner.
// Also blocks network access so no test can reach Anthropic, Upstash, or any other service.
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extensions = [".ts", ".tsx", "/index.ts"];

function resolveTypeScriptFile(basePath) {
  if (path.extname(basePath) && existsSync(basePath)) return basePath;
  for (const extension of extensions) {
    const candidate = `${basePath}${extension}`;
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

globalThis.fetch = async (input) => {
  throw new Error(`Network access is disabled in offline tests: ${String(input)}`);
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    let basePath = null;
    if (specifier.startsWith("@/")) {
      basePath = path.join(projectRoot, specifier.slice(2));
    } else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
      basePath = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    }
    if (basePath) {
      const file = resolveTypeScriptFile(basePath);
      if (file) return nextResolve(pathToFileURL(file).href, context);
    }
    return nextResolve(specifier, context);
  },
});
