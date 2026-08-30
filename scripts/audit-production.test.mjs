import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildProductionInventory } from "./audit-production.mjs";

test("production inventory follows workspace dependencies, not dev tooling", async () => {
  const inventory = await buildProductionInventory(
    await readFile(new URL("../bun.lock", import.meta.url), "utf8"),
  );
  const packages = new Map(
    inventory.results[0].packages.map(({ package: pkg }) => [
      pkg.name,
      pkg.version,
    ]),
  );

  assert.equal(packages.get("image-size"), "1.2.1");
  assert.equal(packages.has("deepmerge-ts"), false);
  assert.equal(packages.has("flatted"), false);
  assert.equal(packages.get("glob"), "13.0.6");
  assert.equal(packages.get("minimatch"), "10.2.4");
  assert.equal(packages.has("path-to-regexp"), false);
  assert.equal(packages.has("undici"), false);
});

test("production inventory handles workspace, optional, peer, variant, and Prisma paths", async () => {
  const fixture = {
    lockfileVersion: 1,
    workspaces: {
      "": {
        name: "fixture",
        dependencies: {
          app: "1.0.0",
          "peer-target": "1.0.0",
          "optional-runtime": "1.0.0",
        },
        devDependencies: { "dev-tool": "1.0.0" },
      },
      "packages/helper": {
        name: "workspace-helper",
        dependencies: { "optional-runtime": "1.0.0" },
      },
    },
    packages: {
      app: [
        "app@1.0.0",
        "",
        {
          dependencies: {
            "workspace-helper": "workspace:*",
            "peer-host": "1.0.0",
            "variant-a": "1.0.0",
            "variant-b": "1.0.0",
            host: "1.0.0",
            "deepmerge-direct": "7.1.5",
          },
          optionalDependencies: { "optional-runtime": "1.0.0" },
        },
        "",
      ],
      "peer-host": [
        "peer-host@1.0.0",
        "",
        { peerDependencies: { "peer-target": "1.0.0" } },
        "",
      ],
      "peer-target": ["peer-target@1.0.0", "", {}, ""],
      "variant-a": ["shared@1.0.0", "", {}, ""],
      "variant-b": ["shared@1.0.0", "", {}, ""],
      host: [
        "host@1.0.0",
        "",
        { dependencies: { "optional-feature": "1.0.0" } },
        "",
      ],
      "optional-feature": [
        "optional-feature@1.0.0",
        "",
        { optionalDependencies: { config: "1.0.0" } },
        "",
      ],
      config: [
        "config@1.0.0",
        "",
        { dependencies: { "deepmerge-prisma": "7.1.5" } },
        "",
      ],
      "deepmerge-direct": ["deepmerge-ts@7.1.5", "", {}, ""],
      "deepmerge-prisma": ["deepmerge-ts@7.1.5", "", {}, ""],
      "optional-runtime": ["optional-runtime@1.0.0", "", {}, ""],
      "dev-tool": [
        "dev-tool@1.0.0",
        "",
        { dependencies: { flatted: "3.3.3" } },
        "",
      ],
      flatted: ["flatted@3.3.3", "", {}, ""],
    },
  };

  const inventory = await buildProductionInventory(JSON.stringify(fixture));
  const packages = inventory.results[0].packages;
  const names = packages.map(({ package: pkg }) => pkg.name);
  const shared = packages.filter(({ package: pkg }) => pkg.name === "shared");

  assert.equal(names.includes("optional-runtime"), true);
  assert.equal(names.includes("peer-target"), true);
  assert.equal(names.includes("dev-tool"), false);
  assert.equal(names.includes("flatted"), false);
  assert.equal(shared.length, 2);
  assert.equal(
    names.includes("deepmerge-ts"),
    true,
    "direct deepmerge path must not be hidden",
  );
  assert.equal(names.includes("optional-feature"), true);
  assert.equal(names.includes("config"), false);
  assert.equal(
    packages
      .find(({ package: pkg }) => pkg.name === "deepmerge-ts")
      .groups.some(({ ids }) => ids[0].includes("optional-feature")),
    false,
  );
});

test("production inventory fails closed for unsupported or unresolved lockfile data", async () => {
  const base = {
    lockfileVersion: 1,
    workspaces: {
      "": { name: "fixture", dependencies: { app: "1.0.0" } },
    },
    packages: {
      app: [
        "app@1.0.0",
        "",
        { dependencies: { missing: "1.0.0" } },
        "",
      ],
    },
  };

  await assert.rejects(
    () => buildProductionInventory(JSON.stringify(base)),
    /cannot resolve missing/,
  );
  await assert.rejects(
    () =>
      buildProductionInventory(
        JSON.stringify({ ...base, lockfileVersion: 2 }),
      ),
    /unsupported lockfileVersion/,
  );
});
