import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

async function files(directory, prefix = "") {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = join(prefix, entry.name);
    if (entry.isDirectory()) found.push(...await files(join(directory, entry.name), relative));
    else found.push(relative);
  }
  return found.sort();
}

test("Pages artifact contains only canonical public files and local assets", async () => {
  execFileSync(process.execPath, ["tools/build_site.mjs"], { cwd: root });
  const assets = (await files(join(root, "assets"))).map((name) => join("assets", name));
  const expected = [".nojekyll", "index.html", "styles.css", "app.js", ...assets].sort();
  assert.deepEqual(await files(join(root, "dist")), expected);
  for (const name of expected.filter((name) => name !== ".nojekyll")) {
    assert.deepEqual(await readFile(join(root, "dist", name)), await readFile(join(root, name)), name);
  }
});
