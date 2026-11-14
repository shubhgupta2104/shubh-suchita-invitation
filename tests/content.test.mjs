import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const script = await readFile(new URL("../app.js", import.meta.url), "utf8");

test("the canonical schedule contains five functions and six meals", () => {
  assert.equal((html.match(/data-kind="function"/g) || []).length, 5);
  assert.equal((html.match(/data-kind="meal"/g) || []).length, 6);
  const times = [...html.matchAll(/datetime="(2027-\d\d-\d\dT[^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(times, [
    "2027-01-25T08:00:00+05:30", "2027-01-25T12:00:00+05:30",
    "2027-01-25T13:00:00+05:30", "2027-01-25T18:00:00+05:30",
    "2027-01-25T20:00:00+05:30", "2027-01-26T08:00:00+05:30",
    "2027-01-26T12:00:00+05:30", "2027-01-26T13:00:00+05:30",
    "2027-01-26T15:00:00+05:30", "2027-01-26T16:30:00+05:30",
    "2027-01-26T19:00:00+05:30"
  ]);
});

test("confirmed names, venue and exact directions are retained", () => {
  for (const text of [
    "S/O Rekha Gupta and Ajay Gupta",
    "D/O Madhu Sharma<br>and Harish Kant Sharma",
    "Evara Resort", "Jim Corbett, Uttarakhand",
    "https://maps.app.goo.gl/PL4M48uGDFwTjAJs6"
  ]) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /Varmala|11:00 AM|Palms|Shubh Gupta|Suchita Sharma/);
});

test("new celebrations have matching original illustrations", async () => {
  const artwork = await readFile(new URL("../assets/artwork/ceremonies.svg", import.meta.url), "utf8");
  for (const event of ["jai-mala", "gala-dinner"]) {
    assert.ok(html.includes(`data-event="${event}"`));
    assert.ok(html.includes(`ceremonies.svg#${event}`));
    assert.ok(artwork.includes(`<symbol id="${event}"`));
  }
  assert.doesNotMatch(html, /2027-01-26T(?:16:00|20:00):00/);
});

test("entrance is progressive, restartable and not stored", () => {
  assert.doesNotMatch(script, /sessionStorage|localStorage|preventDefault\(\).*wheel/);
  assert.match(script, /scrollRestoration = "manual"/);
  assert.doesNotMatch(html, /<dialog[^>]+\bopen\b/);
  assert.doesNotMatch(html, /<html[^>]+entrance-closed/);
  assert.doesNotMatch(html, /skip-invitation|Skip the animation/);
  assert.match(html, /class="wordmark" href="#top"/);
  assert.match(html, /data-event="phere"/);
  assert.match(script, /Date\.parse\(phere\.dateTime\)/);
});

test("only the user-approved responder URL ships, without editor or private references", () => {
  assert.doesNotMatch(html + script, /1OCfOv0HdoC2xsxWgpx-oYi9X79HS982by22Ovy9lmMY/);
  assert.match(html, /href="https:\/\/docs\.google\.com\/forms\/d\/e\/1FAIpQLSf_344lGr0NDc0JVhV59THlmWfkQJUz_X-Tk1L3YIpR10HnkA\/viewform"/);
  assert.doesNotMatch(html, /\/edit|\/Users\/|WhatsApp|reference-contact-sheet/);
  assert.doesNotMatch(html, /<iframe/);
  assert.doesNotMatch(html, /RSVP is not open in this local preview/);
  assert.match(html, /for the latest celebration timings/);
});

test("countdown subtitle is removed and music has no autoplay or controls", () => {
  assert.doesNotMatch(html, /countdown__date|4:00 PM IST/);
  assert.match(html, /<audio[^>]+data-src="assets\/audio\/vaaroon-forever\.m4a"/);
  assert.doesNotMatch(html, /<audio[^>]+\s(?:controls|autoplay)(?:\s|>)/);
});

test("initial invitation resources stay below 1.5 MB before optional media activation", async () => {
  const files = ["index.html", "styles.css", "app.js"];
  for (const directory of ["assets/artwork", "assets/fonts"]) {
    for (const file of await readdir(new URL(`../${directory}/`, import.meta.url))) {
      files.push(`${directory}/${file}`);
    }
  }
  let total = 0;
  for (const file of files) total += (await stat(new URL(`../${file}`, import.meta.url))).size;
  assert.ok(total <= 1_500_000, `Initial resource bytes: ${total}`);
  const mediaTags = [...html.matchAll(/<(?:video|audio)\b[\s\S]*?>/g)].map(match => match[0]);
  assert.equal(mediaTags.length, 2);
  for (const tag of mediaTags) {
    assert.match(tag, /preload="none"/);
    assert.doesNotMatch(tag, /\ssrc="/);
  }
});
