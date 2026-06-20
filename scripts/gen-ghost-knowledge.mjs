#!/usr/bin/env node
// ---------------------------------------------------------------------------
// gen-ghost-knowledge.mjs
//
// Single source of truth bridge: the 9 marketing capabilities live in the
// frontend at frontend/src/data/capabilities.ts. Ghost (the backend prompt)
// must answer "who are you / what can you do" using ONLY those 9 capabilities.
//
// This script transpiles capabilities.ts (which only uses `import type`, so
// the transpile is dependency-free), imports CAPABILITIES + PAGE_CHROME, and
// writes a plain JSON snapshot to backend/app/data/ghost_capabilities.json
// that the backend loads at runtime. Wired into `npm run build` so the JSON
// can never drift from the page content.
// ---------------------------------------------------------------------------
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const FRONTEND_DIR = join(REPO_ROOT, "frontend");
const CAP_TS = join(FRONTEND_DIR, "src", "data", "capabilities.ts");
const OUT_JSON = join(
  REPO_ROOT,
  "backend",
  "app",
  "data",
  "ghost_capabilities.json",
);

// esbuild lives in frontend/node_modules (installed by Vite). Bare specifiers
// resolve relative to THIS script's location (scripts/), so resolve esbuild
// explicitly from the frontend package instead.
async function loadEsbuild() {
  try {
    const req = createRequire(join(FRONTEND_DIR, "package.json"));
    const esbuildPath = req.resolve("esbuild");
    return await import(pathToFileURL(esbuildPath).href);
  } catch {
    return null;
  }
}

const esbuild = await loadEsbuild();
if (!esbuild) {
  console.error(
    "[gen-ghost-knowledge] esbuild not found in frontend/node_modules. " +
      "Run `npm install` in frontend/ first.",
  );
  process.exit(1);
}

async function loadCapabilitiesModule() {
  const source = await readFile(CAP_TS, "utf8");
  // capabilities.ts uses only `import type` — strip types, keep the data.
  const { code } = await esbuild.transform(source, {
    loader: "ts",
    format: "esm",
    target: "esnext",
  });
  // Write the transpiled ESM to a temp file and dynamic-import it.
  const tmpFile = join(
    await mkdir(join(tmpdir(), "ghost-knowledge"), { recursive: true }).then(
      () => join(tmpdir(), "ghost-knowledge"),
    ),
    `capabilities.${process.pid}.mjs`,
  );
  await writeFile(tmpFile, code, "utf8");
  try {
    return await import(`file://${tmpFile}`);
  } finally {
    await rm(tmpFile, { force: true });
  }
}

const mod = await loadCapabilitiesModule();
const CAPABILITIES = mod.CAPABILITIES;
const PAGE_CHROME = mod.PAGE_CHROME;

if (!Array.isArray(CAPABILITIES) || CAPABILITIES.length === 0) {
  console.error("[gen-ghost-knowledge] CAPABILITIES export missing or empty.");
  process.exit(1);
}

const snapshot = {
  // Provenance so the backend / a human can tell where this came from.
  _generated_by: "scripts/gen-ghost-knowledge.mjs",
  _source: "frontend/src/data/capabilities.ts",
  page: {
    en: {
      title: PAGE_CHROME?.en?.heroTitle ?? "What Ghost can do",
      subtitle: PAGE_CHROME?.en?.heroSubtitle ?? "",
    },
    he: {
      title: PAGE_CHROME?.he?.heroTitle ?? "מה Ghost יודע לעשות",
      subtitle: PAGE_CHROME?.he?.heroSubtitle ?? "",
    },
  },
  capabilities: CAPABILITIES.map((cap) => ({
    id: cap.id,
    copy: {
      en: {
        title: cap.copy?.en?.title ?? "",
        simple: cap.copy?.en?.simple ?? "",
        steps: cap.copy?.en?.steps ?? [],
      },
      he: {
        title: cap.copy?.he?.title ?? "",
        simple: cap.copy?.he?.simple ?? "",
        steps: cap.copy?.he?.steps ?? [],
      },
    },
  })),
};

await mkdir(dirname(OUT_JSON), { recursive: true });
await writeFile(OUT_JSON, JSON.stringify(snapshot, null, 2) + "\n", "utf8");

console.log(
  `[gen-ghost-knowledge] wrote ${snapshot.capabilities.length} capabilities -> ${OUT_JSON}`,
);
