import { copyFile, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = join(root, "dist");
const extensions = new Set([".svg", ".jpg", ".ttf", ".txt", ".m4a"]);

async function copyAssets(directory) {
  await mkdir(join(output, directory), { recursive: true });
  for (const entry of await readdir(join(root, directory), { withFileTypes: true })) {
    const relative = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Public assets cannot contain symlinks: ${relative}`);
    if (entry.isDirectory()) {
      await copyAssets(relative);
    } else if (entry.isFile() && extensions.has(extname(entry.name))) {
      await copyFile(join(root, relative), join(output, relative));
    } else if (entry.name !== ".DS_Store") {
      throw new Error(`Unexpected public asset: ${relative}`);
    }
  }
}

await rm(output, { recursive: true, force: true });
await mkdir(output);
for (const name of ["index.html", "styles.css", "app.js"]) {
  await copyFile(join(root, name), join(output, name));
}
for (const directory of ["assets/artwork", "assets/fonts", "assets/audio"]) {
  await copyAssets(directory);
}
await writeFile(join(output, ".nojekyll"), "");
console.log("Built public invitation in dist/. Development files and private artifacts are excluded.");
