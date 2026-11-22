import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, readFile, realpath, rmdir, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { copyWithoutAccessUpdate } from "../scripts/lib/client-media";

test("Windows snapshots reject a junction ancestor and still copy a regular source", { skip: process.platform !== "win32" }, async (t) => {
  const fixture = await realpath(await mkdtemp(path.join(tmpdir(), "media boundary ")));
  const originals = path.join(fixture, "originals");
  const alias = path.join(fixture, "alias");
  const source = path.join(originals, "screen.jpg");
  const aliasOutput = path.join(fixture, "alias-copy");
  const output = path.join(fixture, "regular-copy");
  t.after(async () => {
    for (const file of [aliasOutput, output, alias, source]) {
      try { await unlink(file); } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    await rmdir(originals);
    await rmdir(fixture);
  });
  await mkdir(originals);
  await writeFile(source, "synthetic snapshot bytes");
  await symlink(originals, alias, "junction");

  const failures = copyWithoutAccessUpdate([
    { source: path.join(alias, "screen.jpg"), target: aliasOutput },
    { source, target: output },
  ]);

  assert.deepEqual(failures.map(({ index }) => index), [0]);
  await assert.rejects(lstat(aliasOutput), { code: "ENOENT" });
  assert.equal(await readFile(output, "utf8"), "synthetic snapshot bytes");
});
