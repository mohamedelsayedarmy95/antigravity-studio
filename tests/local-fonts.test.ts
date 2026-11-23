import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const fontDir = new URL("../public/fonts/", import.meta.url);

test("vendored Latin faces and their license notices match the provenance manifest", () => {
  const manifest = JSON.parse(readFileSync(new URL("provenance.json", fontDir), "utf8")) as {
    family: string;
    file: string;
    sha256: string;
    notice: string;
    noticeSha256: string;
    license: string;
  }[];
  assert.deepEqual(manifest.map((face) => face.family), ["Inter", "JetBrains Mono", "Archivo"]);
  for (const face of manifest) {
    const font = readFileSync(new URL(face.file, fontDir));
    const notice = readFileSync(new URL(face.notice, fontDir));
    assert.equal(font.subarray(0, 4).toString("ascii"), "wOF2");
    assert.equal(createHash("sha256").update(font).digest("hex"), face.sha256);
    assert.equal(createHash("sha256").update(notice).digest("hex"), face.noticeSha256);
    assert.equal(face.license, "OFL-1.1");
    assert.match(notice.toString("utf8"), /SIL OPEN FONT LICENSE/i);
  }
});
