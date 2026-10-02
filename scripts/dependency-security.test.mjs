import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const forge = require("node-forge");
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
