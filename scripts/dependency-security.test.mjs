import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { generateKeyPairSync, verify } from "node:crypto";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const forge = require("node-forge");
const braces = require("braces");
const deepmerge = require("deepmerge");
const zod = require("zod");
const { getAssetSize } = require("metro/private/Assets");
const { privateKey: pem } = generateKeyPairSync("rsa", {
  modulusLength: 1024,
  privateKeyEncoding: { type: "pkcs1", format: "pem" },
  publicKeyEncoding: { type: "pkcs1", format: "pem" },
});
const privateKey = forge.pki.privateKeyFromPem(pem);
const publicKey = forge.pki.setRsaPublicKey(privateKey.n, privateKey.e);
const digest = forge.md.sha256.create().update("dependency patch regression").digest().getBytes();
const { asn1 } = forge;
const node = (type, constructed, value) =>
  asn1.create(asn1.Class.UNIVERSAL, type, constructed, value);

function signature({ parameters, extra }) {
  const algorithm = [node(asn1.Type.OID, false, asn1.oidToDer(forge.oids.sha256).getBytes())];
  if (parameters) algorithm.push(node(asn1.Type.NULL, false, ""));
  if (extra) algorithm.push(node(asn1.Type.OCTETSTRING, false, "unexpected child"));
  const info = node(asn1.Type.SEQUENCE, true, [
    node(asn1.Type.SEQUENCE, true, algorithm),
    node(asn1.Type.OCTETSTRING, false, digest),
  ]);
  return forge.pki.rsa.encrypt(asn1.toDer(info).getBytes(), privateKey, 0x01);
}

test("RSA verification accepts valid DigestInfo with and without NULL parameters", () => {
  for (const parameters of [true, false]) {
    assert.equal(publicKey.verify(digest, signature({ parameters, extra: false })), true);
  }
});

test("RSA verification rejects extra nested DigestAlgorithm children (GHSA-86w9-cpqp-85rv)", () => {
  for (const parameters of [true, false]) {
    assert.throws(
      () => publicKey.verify(digest, signature({ parameters, extra: true })),
      /valid RSASSA-PKCS1-v1_5 DigestInfo/,
    );
  }
});

test("upstream node-forge 1.4.2 retains Buffer PEM compatibility", () => {
  assert.equal(require("node-forge/package.json").version, "1.4.2");
  assert.equal(forge.pki.privateKeyFromPem(Buffer.from(pem)).n.toString(), privateKey.n.toString());
});

test("Expo code signing round-trips certificates and produces valid manifest signatures", () => {
  const expoSigning = require("@expo/code-signing-certificates");
  const certificate = expoSigning.generateSelfSignedCodeSigningCertificate({
    keyPair: { privateKey, publicKey },
    validityNotBefore: new Date(Date.now() - 60_000),
    validityNotAfter: new Date(Date.now() + 60_000),
    commonName: "dependency regression only",
  });
  const restored = expoSigning.convertCertificatePEMToCertificate(
    expoSigning.convertCertificateToCertificatePEM(certificate),
  );
  expoSigning.validateSelfSignedCertificate(restored, { privateKey, publicKey });
  const manifest = Buffer.from('{"id":"test-manifest"}');
  const signature = Buffer.from(expoSigning.signBufferRSASHA256AndVerify(privateKey, restored, manifest), "base64");
  const key = forge.pki.publicKeyToPem(publicKey);
  assert.equal(verify("sha256", manifest, key, signature), true);
  assert.equal(verify("sha256", Buffer.from("tampered"), key, signature), false);
});

test("fixed Zod rejects oversized collections before validating their elements", () => {
  let visited = 0;
  const element = zod.z.string().superRefine(() => { visited += 1; });
  for (const [schema, input] of [
    [zod.z.array(element).max(2), ["a", "b", "c"]],
    [zod.z.set(element).max(2), new Set(["a", "b", "c"])],
    [zod.z.map(element, element).max(2), new Map([["a", "a"], ["b", "b"], ["c", "c"]])],
  ]) {
    const result = schema.safeParse(input);
    assert.equal(result.success, false);
    assert.deepEqual(result.error.issues.map(({ code }) => code), ["too_big"]);
  }
  assert.equal(visited, 0);
  assert.deepEqual(zod.z.array(element).max(2).parse(["a", "b"]), ["a", "b"]);
  assert.equal(visited, 2);
});

test("audit exceptions expire and cover only the reviewed package versions", () => {
  const lock = JSON.parse(readFileSync(new URL("../bun.lock", import.meta.url), "utf8").replace(/,\s*([}\]])/g, "$1"));
  // OSV ignores an advisory globally. Guard every instance, including nested
  // versions, so an update cannot silently inherit a reviewed exception.
  const scopes = {
    "node-forge": ["1.4.2"],
    sandbox: ["4.4.0"],
    deepmerge: ["4.3.1"],
    zod: ["3.22.4", "3.25.76", "4.6.7"],
    glob: ["7.2.3", "10.5.0", "13.0.6"],
    minimatch: ["3.1.5", "9.0.9", "10.2.6"],
    "better-auth": ["1.6.22"],
    "@better-auth/core": ["1.6.22"],
    "@better-auth/drizzle-adapter": ["1.6.22"],
    "@better-auth/kysely-adapter": ["1.6.22"],
    "@better-auth/expo": ["1.6.22"],
    "@convex-dev/better-auth": ["0.12.2"],
  };
  for (const [name, versions] of Object.entries(scopes)) {
    const ids = Object.values(lock.packages).map(([id]) => id).filter((id) => id.startsWith(`${name}@`));
    assert.ok(ids.length > 0, `Missing reviewed package ${name}; remove its exception`);
    assert.deepEqual([...new Set(ids)].sort(), versions.map((version) => `${name}@${version}`).sort());
  }
  const config = readFileSync(new URL("../osv-scanner.toml", import.meta.url), "utf8");
  const blocks = config.split("[[IgnoredVulns]]").slice(1);
  assert.deepEqual(blocks.map((block) => block.match(/id = "([^"]+)"/)[1]).sort(), [
    "GHSA-fm4j-4xhm-xpwx", "GHSA-gc25-3vc5-2jf9", "GHSA-mrhx-c7xc-m3w5", "GHSA-gcqx-w48m-w2h4",
    "GHSA-44jh-23m7-hpcf", "GHSA-965c-763c-88jm", "GHSA-q84f-53jg-9ppm", "GHSA-r4xp-prcw-77qf",
    "GHSA-g3hv-75wg-m249", "GHSA-3g3m-2fjr-6pw4",
  ].sort());
  for (const block of blocks) {
    assert.match(block, /owner @rebanto/);
    assert.match(block, /Reviewed 2026-10-30/);
    const expiry = block.match(/ignoreUntil = (\d{4}-\d{2}-\d{2})/)[1];
    assert.equal(expiry, "2026-11-06");
    assert.ok(Date.now() < Date.parse(`${expiry}T00:00:00Z`), `Expired audit exception: ${block}`);
  }
  assert.doesNotMatch(config, /\[\[PackageOverrides\]\]/);
  const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(manifest.overrides["node-forge"], "1.4.2");
  assert.equal(manifest.patchedDependencies["node-forge@1.4.0"], undefined);
});

function globInstallations() {
  const nextPlugin = createRequire(require.resolve("@next/eslint-plugin-next"));
  return [require.resolve("glob/package.json"), nextPlugin.resolve("glob/package.json")];
}

test("minimatch CJS/ESM backports bound preprocessing while retaining ordinary matches", async () => {
  for (const globPackage of globInstallations()) {
    const fromGlob = createRequire(globPackage);
    const root = dirname(fromGlob.resolve("minimatch/package.json"));
    for (const format of ["commonjs", "esm"]) {
      const file = join(root, "dist", format, "index.js");
      const { Minimatch } = format === "commonjs" ? require(file) : await import(pathToFileURL(file).href);
      const pattern = Array(30).fill("**/../a/b").join("/");
      const bounded = vm.runInNewContext("new Minimatch(pattern, { optimizationLevel: 2, braceExpandMax: 64 })", { Minimatch, pattern }, { timeout: 2000 });
      assert.equal(bounded.set.length, 64);
      const ordinary = new Minimatch("**/../a/b/**/../c/d", { optimizationLevel: 2 });
      assert.equal(ordinary.set.length, 4);
      assert.equal(ordinary.match("../a/b/../c/d"), true);
      assert.equal(ordinary.match("x/a/b/y/c/d"), true);
      const large = new Minimatch("{x,*}/{0..999}", { optimizationLevel: 2 });
      assert.equal(large.set.length, 2000);
      assert.equal(large.match("x/5"), true);
      assert.equal(large.match("y/999"), true);
      assert.equal(large.match(".y/5"), false);
    }
  }
  const legacy = require("minimatch");
  assert.equal(require("minimatch/package.json").version, "3.1.5");
  assert.equal(legacy.Minimatch.prototype.firstPhasePreProcess, undefined);
  assert.doesNotMatch(readFileSync(require.resolve("minimatch"), "utf8"), /firstPhasePreProcess|optimizationLevel/);
  assert.equal(legacy("src/app.ts", "src/**/*.ts"), true);
});

test("glob CJS/ESM cancellation stops all four walker entry points and normal traversal works", async () => {
  const fixture = mkdtempSync(join(tmpdir(), "ia-glob-security-"));
  try {
    mkdirSync(join(fixture, "nested"));
    writeFileSync(join(fixture, "a.ts"), "test");
    writeFileSync(join(fixture, "nested", "b.ts"), "test");
    writeFileSync(join(fixture, "nested", "ignored.txt"), "test");
    for (const packageFile of globInstallations()) {
      for (const format of ["commonjs", "esm"]) {
        const root = join(dirname(packageFile), "dist", format);
        const walkerFile = join(root, "walker.js");
        const { GlobUtil } = format === "commonjs" ? require(walkerFile) : await import(pathToFileURL(walkerFile).href);
        for (const method of ["walkCB", "walkCB2", "walkCBSync", "walkCB2Sync"]) {
          const controller = new AbortController();
          const walker = new GlobUtil([], {}, { platform: process.platform, signal: controller.signal });
          const mustNotContinue = () => { throw new Error(`Continued after abort: ${method}`); };
          let callbacks = 0;
          const done = () => { callbacks += 1; };
          controller.abort();
          if (method === "walkCB" || method === "walkCBSync") {
            walker[method === "walkCB" ? "walkCB2" : "walkCB2Sync"] = mustNotContinue;
            walker[method]({}, [], done);
          } else {
            walker[method]({}, [], { processPatterns: mustNotContinue }, done);
          }
          assert.equal(callbacks, 1);
        }
        const index = join(root, "index.js");
        const glob = format === "commonjs" ? require(index) : await import(pathToFileURL(index).href);
        const options = { cwd: fixture, posix: true };
        const expected = ["a.ts", "nested/b.ts"];
        assert.deepEqual((await glob.glob("**/*.ts", options)).sort(), expected);
        assert.deepEqual(glob.globSync("**/*.ts", options).sort(), expected);
        const streamed = [];
        for await (const file of glob.globStream("**/*.ts", options)) streamed.push(file);
        assert.deepEqual(streamed.sort(), expected);
      }
    }
  } finally {
    assert.equal(dirname(resolve(fixture)), resolve(tmpdir()));
    assert.match(basename(fixture), /^ia-glob-security-/);
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("Metro reads PNG and GIF dimensions after the image-size security upgrade", () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE1EAAAAASUVORK5CYII=", "base64");
  const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
  assert.deepEqual(getAssetSize("png", png, "pixel.png"), { width: 1, height: 1 });
  assert.deepEqual(getAssetSize("gif", gif, "pixel.gif"), { width: 1, height: 1 });
  assert.equal(getAssetSize("txt", Buffer.from("text"), "text.txt"), null);
});

test("braces rejects excessive string nesting before recursive AST processing (GHSA-vfj7-8cjw-p6xm)", () => {
  for (const [open, close] of [["{", "}"], ["(", ")"]]) {
    const pattern = open.repeat(4000) + "a" + close.repeat(4000);
    for (const method of ["parse", "compile", "stringify", "expand"]) {
      for (const maxDepth of [undefined, 10000, Infinity, NaN]) {
        assert.throws(() => braces[method](pattern, { maxDepth }), /exceeds max depth/);
      }
    }
    assert.doesNotThrow(() => braces.parse(open.repeat(100) + "a" + close.repeat(100)));
    assert.throws(() => braces.parse(open.repeat(101) + "a" + close.repeat(101)), /exceeds max depth/);
  }
  assert.throws(() => braces.parse("({a,b})", { maxDepth: 1 }), /exceeds max depth/);
  assert.doesNotThrow(() => braces.parse("({a,b})", { maxDepth: 2 }));
});

test("braces guards direct AST inputs and cyclic parent chains", () => {
  for (const method of ["compile", "stringify", "expand"]) {
    let ast = { type: "text", value: "a" };
    for (let index = 0; index < 1000; index += 1) ast = { type: "brace", nodes: [ast] };
    assert.throws(() => braces[method]({ type: "root", nodes: [ast] }), /exceeds max depth/);
  }
  const ast = { type: "paren", nodes: [{ type: "text", value: "a" }] };
  ast.parent = ast;
  assert.throws(
    () => vm.runInNewContext("braces.expand(ast)", { braces, ast }, { timeout: 1000 }),
    /AST parent chain contains a cycle/,
  );
});

test("braces retains ordinary glob expansion and escapeInvalid output", () => {
  assert.deepEqual(braces.expand("src/{app,lib}/file-{1..3}.ts"), [
    "src/app/file-1.ts", "src/app/file-2.ts", "src/app/file-3.ts",
    "src/lib/file-1.ts", "src/lib/file-2.ts", "src/lib/file-3.ts",
  ]);
  assert.deepEqual(braces.expand("foo/({a,b})"), ["foo/(a)", "foo/(b)"]);
  assert.equal(braces.compile("a/{b,c}/d"), "a/(b|c)/d");
  for (const pattern of ["{{a}}", "{a,{b}}", "{{x}y}", "{a,{b,{c}}}", "{}{a}"]) {
    assert.equal(braces.stringify(pattern, { escapeInvalid: true }), pattern);
  }
});


test("OSV sandbox exceptions apply only to the Vercel CLI package identity", () => {
  const lock = JSON.parse(readFileSync(new URL("../bun.lock", import.meta.url), "utf8").replace(/,\s*([}\]])/g, "$1"));
  const instances = Object.values(lock.packages).filter(([id]) => id.startsWith("sandbox@"));
  assert.ok(instances.length > 0);
  for (const [id] of instances) assert.equal(id, "sandbox@4.4.0");
  const cli = JSON.parse(readFileSync(new URL("../node_modules/sandbox/package.json", import.meta.url), "utf8"));
  assert.equal(cli.version, "4.4.0");
  assert.equal(cli.repository.url, "https://github.com/vercel/sandbox.git");
  assert.equal(cli.repository.directory, "packages/sandbox");
});

test("deepmerge rejects prototype keys from both merge inputs (GHSA-gcqx-w48m-w2h4)", () => {
  for (const entry of ["deepmerge", "deepmerge/dist/umd.js"]) {
    const merge = require(entry);
    const poisoned = JSON.parse('{"__proto__":{"injected":true},"nested":{"safe":1}}');
    for (const [target, source] of [
      [Object.create(null), poisoned],
      [{ nested: null }, { nested: poisoned }],
      [poisoned, { ordinary: true }],
    ]) {
      const result = merge(target, source);
      assert.equal(result.injected, undefined);
      assert.equal(result.nested?.injected, undefined);
      assert.equal(Object.getPrototypeOf(result), Object.prototype);
      assert.equal(Object.hasOwn(result, "__proto__"), false);
    }
  }
  assert.deepEqual(deepmerge({ a: { b: 1 }, list: [1] }, { a: { c: 2 }, list: [2] }), {
    a: { b: 1, c: 2 }, list: [1, 2],
  });
});

test("Better Auth audit exceptions remain limited to the pinned unused feature configuration", () => {
  const lock = JSON.parse(readFileSync(new URL("../bun.lock", import.meta.url), "utf8").replace(/,\s*([}\]])/g, "$1"));
  const names = ["better-auth", "@better-auth/drizzle-adapter", "@better-auth/kysely-adapter"];
  for (const name of names) {
    const instances = Object.values(lock.packages).filter(([id]) => id.startsWith(`${name}@`));
    assert.ok(instances.length > 0);
    for (const [id] of instances) assert.equal(id, `${name}@1.6.22`);
  }
  const source = readFileSync(new URL("../apps/convex/src/auth.ts", import.meta.url), "utf8");
  const ast = ts.createSourceFile("auth.ts", source, ts.ScriptTarget.Latest, true);
  const pluginImports = ast.statements.filter((node) => ts.isImportDeclaration(node) && node.moduleSpecifier.text === "better-auth/plugins");
  assert.equal(pluginImports.length, 1);
  assert.deepEqual(pluginImports[0].importClause.namedBindings.elements.map((binding) => [
    binding.propertyName?.text ?? binding.name.text, binding.name.text,
  ]), [["admin", "admin"], ["username", "username"]]);
  const integration = require("@convex-dev/better-auth/package.json");
  assert.equal(integration.peerDependencies["better-auth"], ">=1.6.9 <1.7.0");
  let options;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "createAuthOptions") options = node.initializer.body;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  while (ts.isParenthesizedExpression(options) || ts.isSatisfiesExpression(options)) options = options.expression;
  assert.ok(ts.isObjectLiteralExpression(options));
  // Fail closed if new options, spreads, providers or plugin calls are added.
  const properties = options.properties;
  assert.ok(properties.every((property) => ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)));
  assert.deepEqual(properties.map((property) => property.name.getText(ast)).sort(), [
    "secret", "baseURL", "basePath", "trustedOrigins", "database", "disabledPaths", "session", "emailAndPassword", "plugins",
  ].sort());
  const database = properties.find((property) => property.name.getText(ast) === "database").initializer;
  assert.equal(database.getText(ast), "authComponent.adapter(ctx)");
  const plugins = properties.find((property) => property.name.getText(ast) === "plugins").initializer;
  assert.ok(ts.isArrayLiteralExpression(plugins));
  assert.ok(plugins.elements.every(ts.isCallExpression));
  assert.deepEqual(plugins.elements.map((plugin) => plugin.expression.getText(ast)), [
    "createLoginRateLimitPlugin", "username", "admin", "expo", "convex",
  ]);
  assert.doesNotMatch(source, /(?:magicLink|genericOAuth|oauthProxy|deviceAuthorization|drizzleAdapter|kyselyAdapter)\s*\(/);
});
