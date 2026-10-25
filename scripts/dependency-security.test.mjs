import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generateKeyPairSync } from "node:crypto";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const forge = require("node-forge");
const braces = require("braces");
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

test("Zod advisory exception never masks a vulnerable v4 dependency", () => {
  const lock = JSON.parse(readFileSync(new URL("../bun.lock", import.meta.url), "utf8").replace(/,\s*([}\]])/g, "$1"));
  const versions = Object.values(lock.packages)
    .map(([id]) => /^zod@(4\.\d+\.\d+)$/.exec(id)?.[1])
    .filter(Boolean);
  assert.ok(versions.length > 0);
  for (const version of versions) {
    const [, minor, patch] = version.split(".").map(Number);
    assert.ok(minor > 6 || (minor === 6 && patch >= 6), `Vulnerable Zod ${version}`);
  }
});
