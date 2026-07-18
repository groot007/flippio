#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const projectRoot = process.cwd();
const uaDir = path.join(projectRoot, ".ua");
const tmpDir = path.join(uaDir, "tmp");
const pluginRoot = "/Users/mykolastanislavchuk/.understand-anything/repo/understand-anything-plugin";
const extractStructureScript = path.join(pluginRoot, "skills/understand/extract-structure.mjs");
const fingerprintScript = path.join(pluginRoot, "skills/understand/build-fingerprints.mjs");

const scan = JSON.parse(fs.readFileSync(path.join(tmpDir, "ua-scan-files.json"), "utf8"));
const importMapOutput = JSON.parse(fs.readFileSync(path.join(tmpDir, "ua-import-map-output.json"), "utf8"));
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));
const readme = fs.existsSync(path.join(projectRoot, "README.md"))
  ? fs.readFileSync(path.join(projectRoot, "README.md"), "utf8")
  : "";
const commitHash = spawnSync("git", ["rev-parse", "HEAD"], { cwd: projectRoot, encoding: "utf8" }).stdout.trim();
const analyzedAt = new Date().toISOString();

const files = scan.files;
const importMap = importMapOutput.importMap || {};
const chunkSize = 40;
const extractionResults = [];

function kebab(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function titleCase(value) {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, ch => ch.toUpperCase());
}

function inferFrameworks() {
  const deps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
  const found = new Set();
  const map = [
    ["react", "React"],
    ["vite", "Vite"],
    ["vitest", "Vitest"],
    ["zustand", "Zustand"],
    ["@chakra-ui/react", "Chakra UI"],
    ["@tanstack/react-query", "TanStack Query"],
    ["@tauri-apps/api", "Tauri"],
    ["@tauri-apps/cli", "Tauri"],
    ["ag-grid-community", "AG Grid"],
    ["typescript", "TypeScript"],
  ];
  for (const [name, label] of map) {
    if (deps[name]) found.add(label);
  }
  if (files.some(file => file.path.startsWith(".github/workflows/"))) found.add("GitHub Actions");
  return [...found];
}

function inferProjectDescription() {
  const pkg = packageJson.description?.trim();
  if (pkg)
    return "Desktop database viewer built with Tauri and React for inspecting and editing SQLite data across mobile devices and local files.";
  const firstOverview = readme.match(/## Overview\s+([\s\S]*?)\n## /);
  if (firstOverview)
    return firstOverview[1].trim().split("\n").join(" ").replace(/\s+/g, " ").slice(0, 220);
  return "Desktop database viewer for browsing and editing SQLite databases from devices and local files.";
}

function nodeTypeForFile(file) {
  if (file.fileCategory === "docs") return "document";
  if (file.fileCategory === "config") return "config";
  if (file.fileCategory === "infra") {
    if (file.path.startsWith(".github/workflows/") || file.path.includes("gitlab") || file.path.includes("Jenkinsfile")) return "pipeline";
    if (file.language === "terraform" || /(^|\/)k8s\//.test(file.path)) return "resource";
    return "service";
  }
  if (file.fileCategory === "data") {
    if (["graphql", "protobuf", "prisma"].includes(file.language)) return "schema";
    if (file.language === "sql" || ["csv", "tsv"].includes(file.language)) return "table";
    return "schema";
  }
  return "file";
}

function nodeIdForFile(file) {
  return `${nodeTypeForFile(file)}:${file.path}`;
}

function complexityForLines(lines) {
  if (lines > 200) return "complex";
  if (lines >= 50) return "moderate";
  return "simple";
}

function summarizeFile(file, extracted) {
  const base = path.basename(file.path);
  if (file.path === "README.md") {
    return "Introduces Flippio, its device-database workflow, setup requirements, and day-to-day usage patterns.";
  }
  if (base === "package.json") {
    return "Defines the desktop app's JavaScript toolchain, scripts, and frontend dependencies.";
  }
  if (file.path === "src-tauri/src/main.rs") {
    return "Bootstraps the Tauri backend and registers command entry points used by the renderer.";
  }
  if (file.path === "src/renderer/src/main.tsx") {
    return "Mounts the React renderer application and wires up the desktop UI entry point.";
  }
  const parts = file.path.split("/");
  const stem = base.replace(/\.[^.]+$/, "");
  if (file.fileCategory === "docs") return `Documents ${titleCase(stem)} for the Flippio project and its developer workflows.`;
  if (file.fileCategory === "config") return `Configures ${titleCase(stem)} for the Flippio build, tooling, or runtime environment.`;
  if (file.fileCategory === "infra") return `Describes ${titleCase(stem)} infrastructure and release automation for the desktop application.`;
  if (file.fileCategory === "data") return `Defines ${titleCase(stem)} database-facing structures or fixture data used by the project.`;
  if (file.fileCategory === "script") return `Automates ${titleCase(stem)} tasks for development, testing, or release workflows.`;
  if (parts.includes("components")) return `Implements the ${titleCase(stem)} UI module inside the React renderer.`;
  if (parts.includes("hooks")) return `Coordinates ${titleCase(stem)} state transitions and asynchronous data flow in the renderer.`;
  if (parts.includes("store")) return `Maintains ${titleCase(stem)} application state shared across the renderer.`;
  if (parts.includes("commands")) return `Implements the ${titleCase(stem)} Tauri command surface used by the desktop frontend.`;
  if (parts.includes("utils")) return `Provides ${titleCase(stem)} helpers reused across the Flippio codebase.`;
  if (parts.includes("test")) return `Exercises ${titleCase(stem)} behavior through automated test coverage.`;
  if (extracted?.metrics?.functionCount || extracted?.metrics?.classCount) {
    return `Implements ${titleCase(stem)} with the project's primary logic for this area of the application.`;
  }
  return `Defines ${titleCase(stem)} within the Flippio application codebase.`;
}

function tagsForFile(file) {
  const tags = new Set();
  if (file.path === "README.md") tags.add("documentation");
  if (/test|spec/i.test(file.path)) tags.add("test");
  if (file.path.endsWith("main.tsx") || file.path.endsWith("main.rs")) tags.add("entry-point");
  if (file.path.includes("/components/")) tags.add("component");
  if (file.path.includes("/hooks/")) tags.add("hook");
  if (file.path.includes("/store/")) tags.add("state");
  if (file.path.includes("/commands/")) tags.add("service");
  if (file.fileCategory === "config") tags.add("configuration");
  if (file.fileCategory === "docs") tags.add("documentation");
  if (file.fileCategory === "infra") tags.add("infrastructure");
  if (file.fileCategory === "data") tags.add("database");
  if (file.fileCategory === "script") tags.add("automation");
  if (file.language === "typescript") tags.add("typescript");
  if (file.language === "rust") tags.add("rust");
  if (file.path.startsWith(".github/workflows/")) tags.add("ci-cd");
  if (tags.size < 3) tags.add("flippio");
  if (tags.size < 3) tags.add("desktop-app");
  return [...tags].slice(0, 5);
}

function childNodeSummary(kind, name, filePath) {
  const label = titleCase(name);
  if (kind === "function") return `Implements ${label} within ${path.basename(filePath)}.`;
  if (kind === "class") return `Provides the ${label} type defined in ${path.basename(filePath)}.`;
  if (kind === "service") return `Represents the ${label} service declared in ${path.basename(filePath)}.`;
  if (kind === "resource") return `Represents the ${label} resource declared in ${path.basename(filePath)}.`;
  if (kind === "endpoint") return `Describes the ${label} endpoint extracted from ${path.basename(filePath)}.`;
  if (kind === "schema") return `Captures the ${label} schema definition from ${path.basename(filePath)}.`;
  return `Represents ${label} defined in ${path.basename(filePath)}.`;
}

function childTags(kind, file) {
  const tags = new Set([kind]);
  if (file.path.includes("/components/")) tags.add("component");
  if (file.path.includes("/commands/")) tags.add("service");
  if (file.path.includes("/hooks/")) tags.add("hook");
  if (/test|spec/i.test(file.path)) tags.add("test");
  if (tags.size < 3) tags.add(file.language);
  return [...tags].filter(Boolean).slice(0, 4);
}

function addEdge(edges, source, target, type, weight = 0.5) {
  edges.push({ source, target, type, weight });
}

for (let index = 0; index < files.length; index += chunkSize) {
  const batchFiles = files.slice(index, index + chunkSize);
  const batchIndex = Math.floor(index / chunkSize) + 1;
  const inputPath = path.join(tmpDir, `ua-file-analyzer-input-${batchIndex}.json`);
  const outputPath = path.join(tmpDir, `ua-file-extract-results-${batchIndex}.json`);
  fs.writeFileSync(inputPath, JSON.stringify({
    projectRoot,
    batchFiles,
    batchImportData: Object.fromEntries(batchFiles.map(file => [file.path, importMap[file.path] || []])),
  }, null, 2));
  const run = spawnSync("node", [extractStructureScript, inputPath, outputPath], {
    cwd: projectRoot,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (run.status !== 0) {
    throw new Error(`extract-structure failed for batch ${batchIndex}: ${run.stderr || run.stdout}`);
  }
  const extracted = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  extractionResults.push(...(extracted.results || []));
}

const extractedByPath = new Map(extractionResults.map(result => [result.path, result]));
const nodes = [];
const edges = [];
const nodeIds = new Set();
const fileNodeIds = new Set();
const localFunctionIds = new Map();

function pushNode(node) {
  if (nodeIds.has(node.id)) return;
  nodeIds.add(node.id);
  nodes.push(node);
}

for (const file of files) {
  const extracted = extractedByPath.get(file.path);
  const type = nodeTypeForFile(file);
  const fileNode = {
    id: nodeIdForFile(file),
    type,
    name: path.basename(file.path),
    filePath: file.path,
    summary: summarizeFile(file, extracted),
    complexity: complexityForLines(file.sizeLines),
    tags: tagsForFile(file),
  };
  pushNode(fileNode);
  fileNodeIds.add(fileNode.id);

  const functionIdsByName = new Map();
  const functions = extracted?.functions || [];
  for (const fn of functions) {
    const span = Math.max(0, (fn.endLine || 0) - (fn.startLine || 0) + 1);
    const isExported = (extracted.exports || []).some(exp => exp.name === fn.name);
    if (span < 10 && !isExported) continue;
    const id = `function:${file.path}:${fn.name}`;
    functionIdsByName.set(fn.name, id);
    pushNode({
      id,
      type: "function",
      name: fn.name,
      filePath: file.path,
      summary: childNodeSummary("function", fn.name, file.path),
      complexity: complexityForLines(span),
      tags: childTags("function", file),
    });
    addEdge(edges, fileNode.id, id, "contains", 1.0);
  }

  const classes = extracted?.classes || [];
  for (const cls of classes) {
    const span = Math.max(0, (cls.endLine || 0) - (cls.startLine || 0) + 1);
    const isExported = (extracted.exports || []).some(exp => exp.name === cls.name);
    if ((cls.methods || []).length < 2 && span < 20 && !isExported) continue;
    const id = `class:${file.path}:${cls.name}`;
    pushNode({
      id,
      type: "class",
      name: cls.name,
      filePath: file.path,
      summary: childNodeSummary("class", cls.name, file.path),
      complexity: complexityForLines(span),
      tags: childTags("class", file),
    });
    addEdge(edges, fileNode.id, id, "contains", 1.0);
  }

  for (const service of extracted?.services || []) {
    const id = `service:${file.path}:${service.name}`;
    pushNode({
      id,
      type: "service",
      name: service.name,
      filePath: file.path,
      summary: childNodeSummary("service", service.name, file.path),
      complexity: "simple",
      tags: ["service", "infrastructure", file.language].filter(Boolean).slice(0, 4),
    });
    addEdge(edges, fileNode.id, id, "contains", 1.0);
  }

  for (const resource of extracted?.resources || []) {
    const id = `resource:${file.path}:${resource.name}`;
    pushNode({
      id,
      type: "resource",
      name: resource.name,
      filePath: file.path,
      summary: childNodeSummary("resource", resource.name, file.path),
      complexity: "simple",
      tags: ["resource", "infrastructure", kebab(resource.kind || "resource")].slice(0, 4),
    });
    addEdge(edges, fileNode.id, id, "contains", 1.0);
  }

  for (const endpoint of extracted?.endpoints || []) {
    const name = `${endpoint.method} ${endpoint.path}`;
    const id = `endpoint:${file.path}:${name}`;
    pushNode({
      id,
      type: "endpoint",
      name,
      filePath: file.path,
      summary: childNodeSummary("endpoint", name, file.path),
      complexity: "simple",
      tags: ["endpoint", "api-schema", file.language].filter(Boolean).slice(0, 4),
    });
    addEdge(edges, fileNode.id, id, "contains", 1.0);
  }

  for (const definition of extracted?.definitions || []) {
    if (!["message", "type", "schema", "table", "enum"].includes((definition.kind || "").toLowerCase())) continue;
    const id = `schema:${file.path}:${definition.name}`;
    pushNode({
      id,
      type: "schema",
      name: definition.name,
      filePath: file.path,
      summary: childNodeSummary("schema", definition.name, file.path),
      complexity: complexityForLines(Math.max(0, (definition.endLine || 0) - (definition.startLine || 0) + 1)),
      tags: ["schema", "data-model", file.language].filter(Boolean).slice(0, 4),
    });
    addEdge(edges, fileNode.id, id, "contains", 1.0);
  }

  for (const [caller, callee] of (extracted?.callGraph || []).map(entry => [entry.caller, entry.callee])) {
    const callerId = functionIdsByName.get(caller);
    const calleeId = functionIdsByName.get(callee);
    if (callerId && calleeId) addEdge(edges, callerId, calleeId, "calls", 0.8);
  }

  localFunctionIds.set(file.path, functionIdsByName);
}

for (const [sourcePath, targets] of Object.entries(importMap)) {
  const sourceId = nodeIdForFile(files.find(file => file.path === sourcePath) || { path: sourcePath, fileCategory: "code", language: "unknown" });
  if (!fileNodeIds.has(sourceId)) continue;
  for (const targetPath of targets || []) {
    const targetFile = files.find(file => file.path === targetPath);
    if (!targetFile) continue;
    const targetId = nodeIdForFile(targetFile);
    if (!fileNodeIds.has(targetId)) continue;
    addEdge(edges, sourceId, targetId, "imports", 0.7);
  }
}

const edgeSeen = new Set();
const dedupedEdges = [];
for (const edge of edges) {
  if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
  const key = `${edge.source}|${edge.target}|${edge.type}`;
  if (edgeSeen.has(key)) continue;
  edgeSeen.add(key);
  dedupedEdges.push(edge);
}

function matchesAny(id, patterns) {
  return patterns.some(pattern => id.includes(pattern));
}

const layerSpecs = [
  {
    id: "layer:project-overview",
    name: "Project Overview",
    description: "Repository-level documentation, manifests, and shared configuration that define Flippio's overall shape.",
    match: id => matchesAny(id, ["README.md", "package.json", "tsconfig", "vitest.config", "eslint", "CHANGELOG", "LICENSE"]),
  },
  {
    id: "layer:renderer-ui",
    name: "Renderer UI",
    description: "React presentation components that drive device selection, grids, and row editing workflows.",
    match: id => matchesAny(id, ["src/renderer/src/components/", "src/renderer/src/theme", "src/renderer/src/styles"]),
  },
  {
    id: "layer:renderer-state",
    name: "Renderer State",
    description: "Frontend hooks, stores, bridge code, and utilities that orchestrate renderer-side data flow.",
    match: id => matchesAny(id, ["src/renderer/src/hooks/", "src/renderer/src/store/", "src/renderer/src/utils/", "src/renderer/src/tauri-api.ts", "src/renderer/src/types/", "src/renderer/src/main.tsx", "src/renderer/src/App"]),
  },
  {
    id: "layer:tauri-backend",
    name: "Tauri Backend",
    description: "Rust commands and application bootstrap code that connect Flippio to device and filesystem operations.",
    match: id => matchesAny(id, ["src-tauri/src/"]),
  },
  {
    id: "layer:tooling-and-release",
    name: "Tooling And Release",
    description: "Automation, CI, and release assets that support development, packaging, and distribution.",
    match: id => matchesAny(id, ["scripts/", ".github/workflows/", "docs/", "vitest", "example_app/app.json"]),
  },
  {
    id: "layer:examples-and-tests",
    name: "Examples And Tests",
    description: "Reference apps, fixtures, and automated tests that validate the app across supported flows.",
    match: id => matchesAny(id, ["example_app/", "test", "__tests__", "__mocks__", "fixtures"]),
  },
];

const assignedFileNodes = new Set();
const layers = layerSpecs.map(spec => {
  const nodeIdsForLayer = [...fileNodeIds].filter(id => spec.match(id));
  nodeIdsForLayer.forEach(id => assignedFileNodes.add(id));
  return {
    id: spec.id,
    name: spec.name,
    description: spec.description,
    nodeIds: nodeIdsForLayer,
  };
}).filter(layer => layer.nodeIds.length > 0);

const unassigned = [...fileNodeIds].filter(id => !assignedFileNodes.has(id));
if (unassigned.length > 0) {
  layers.push({
    id: "layer:miscellaneous",
    name: "Miscellaneous",
    description: "Remaining project files that do not fit the main architectural groupings.",
    nodeIds: unassigned,
  });
}

function existingNodeIds(paths) {
  return paths.map(filePath => {
    const file = files.find(candidate => candidate.path === filePath);
    return file ? nodeIdForFile(file) : null;
  }).filter(Boolean);
}

const tour = [
  {
    order: 1,
    title: "Start With Project Context",
    description: "Read the repository overview and workspace manifests before following the runtime code paths.",
    nodeIds: existingNodeIds(["README.md", "package.json"]),
  },
  {
    order: 2,
    title: "Trace The App Entry Points",
    description: "Follow how the React renderer and Tauri backend boot and connect to each other.",
    nodeIds: existingNodeIds(["src/renderer/src/main.tsx", "src-tauri/src/main.rs"]),
  },
  {
    order: 3,
    title: "Inspect Device And Navigation UI",
    description: "Move through the top-level selectors and layout components that guide device, app, and database selection.",
    nodeIds: existingNodeIds([
      "src/renderer/src/components/layout/TopSelectors.tsx",
      "src/renderer/src/components/layout/Layout.tsx",
    ]),
  },
  {
    order: 4,
    title: "Study Data Loading And Editing",
    description: "Focus on hooks, stores, and data components that manage tables, SQL, and row edits.",
    nodeIds: existingNodeIds([
      "src/renderer/src/components/data/DataTable.tsx",
      "src/renderer/src/hooks/useDatabaseTables.ts",
      "src/renderer/src/store/tableData.ts",
    ]),
  },
  {
    order: 5,
    title: "Review Backend Device Commands",
    description: "Examine the Rust commands that perform simulator, device, and filesystem work for the renderer.",
    nodeIds: existingNodeIds([
      "src-tauri/src/commands/mod.rs",
      "src-tauri/src/commands/database_commands.rs",
    ]),
  },
  {
    order: 6,
    title: "Close With Tooling And Release",
    description: "Finish with the scripts and workflows that build, test, and ship Flippio releases.",
    nodeIds: existingNodeIds([
      "scripts/update-version.js",
      ".github/workflows/tauri-release.yml",
    ]),
  },
].filter(step => step.nodeIds.length > 0);

const graph = {
  version: "1.0.0",
  project: {
    name: packageJson.name || path.basename(projectRoot),
    languages: Object.keys(scan.stats?.byLanguage || {}).sort(),
    frameworks: inferFrameworks(),
    description: inferProjectDescription(),
    analyzedAt,
    gitCommitHash: commitHash,
  },
  nodes,
  edges: dedupedEdges,
  layers,
  tour,
};

fs.writeFileSync(path.join(uaDir, "knowledge-graph.json"), JSON.stringify(graph, null, 2));
fs.writeFileSync(path.join(uaDir, "meta.json"), JSON.stringify({
  lastAnalyzedAt: analyzedAt,
  gitCommitHash: commitHash,
  version: "1.0.0",
  analyzedFiles: files.length,
}, null, 2));

const fingerprintInputPath = path.join(tmpDir, "fingerprint-input.json");
fs.writeFileSync(fingerprintInputPath, JSON.stringify({
  projectRoot,
  sourceFilePaths: files.map(file => file.path),
  gitCommitHash: commitHash,
}, null, 2));
spawnSync("node", [fingerprintScript, fingerprintInputPath], {
  cwd: projectRoot,
  encoding: "utf8",
  stdio: "pipe",
});

const nodeTypes = {};
for (const node of nodes) nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
const edgeTypes = {};
for (const edge of dedupedEdges) edgeTypes[edge.type] = (edgeTypes[edge.type] || 0) + 1;

console.log(JSON.stringify({
  files: files.length,
  nodes: nodes.length,
  edges: dedupedEdges.length,
  layers: layers.length,
  tour: tour.length,
  nodeTypes,
  edgeTypes,
}, null, 2));
