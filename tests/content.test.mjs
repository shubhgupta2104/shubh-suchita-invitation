import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { prefilledForm } from "./fixtures/rsvp.mjs";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const script = await readFile(new URL("../app.js", import.meta.url), "utf8");

function mp4Boxes(bytes, start = 0, end = bytes.length) {
  const boxes = [];
  while (start < end) {
    const size = bytes.readUInt32BE(start);
    assert.ok(size >= 8 && start + size <= end, "complete MP4 box");
    boxes.push({ type: bytes.toString("ascii", start + 4, start + 8), start, body: start + 8, end: start + size });
    start += size;
  }
  assert.equal(start, end);
  return boxes;
}

test("responsive opening movies are silent fast-start H.264 with exactly 162 frames at 24 fps", async () => {
  for (const [name, width, height] of [["curtain-reveal.mp4", 720, 1440], ["curtain-reveal-wide.mp4", 1600, 900]]) {
    const bytes = await readFile(new URL(`../assets/video/${name}`, import.meta.url));
    const child = (parent, type) => {
      const result = mp4Boxes(bytes, parent.body, parent.end).find(box => box.type === type);
      assert.ok(result, `${name}: ${type}`);
      return result;
    };
    const top = mp4Boxes(bytes);
    const moov = top.find(box => box.type === "moov");
    assert.ok(moov.start < top.find(box => box.type === "mdat").start, "fast-start index");
    const tracks = mp4Boxes(bytes, moov.body, moov.end).filter(box => box.type === "trak");
    assert.equal(tracks.length, 1, "one video track, no audio track");
    const media = child(tracks[0], "mdia");
    const handler = child(media, "hdlr");
    assert.equal(bytes.toString("ascii", handler.body + 8, handler.body + 12), "vide");
    const header = child(media, "mdhd");
    assert.equal(bytes[header.body], 0, "version-zero media header");
    const timescale = bytes.readUInt32BE(header.body + 12);
    const table = child(child(media, "minf"), "stbl");
    const description = child(table, "stsd");
    const sampleEntry = description.body + 8;
    assert.equal(bytes.toString("ascii", sampleEntry + 4, sampleEntry + 8), "avc1");
    assert.equal(bytes.readUInt16BE(sampleEntry + 32), width);
    assert.equal(bytes.readUInt16BE(sampleEntry + 34), height);
    assert.equal(bytes.readUInt32BE(child(table, "stsz").body + 8), 162);
    const timing = child(table, "stts");
    const entries = bytes.readUInt32BE(timing.body + 4);
    let frames = 0;
    let duration = 0;
    for (let index = 0; index < entries; index++) {
      const count = bytes.readUInt32BE(timing.body + 8 + index * 8);
      const delta = bytes.readUInt32BE(timing.body + 12 + index * 8);
      assert.equal(delta * 24, timescale);
      frames += count;
      duration += count * delta;
    }
    assert.equal(frames, 162);
    assert.equal(duration / timescale, 6.75);
  }
});

test("the canonical schedule contains six functions and six meals in time order", () => {
  assert.equal((html.match(/data-kind="function"/g) || []).length, 6);
  assert.equal((html.match(/data-kind="meal"/g) || []).length, 6);
  const times = [...html.matchAll(/datetime="(2027-\d\d-\d\dT[^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(times, [
    "2027-01-25T12:00:00+05:30",
    "2027-01-25T13:00:00+05:30", "2027-01-25T18:00:00+05:30",
    "2027-01-25T20:00:00+05:30", "2027-01-26T08:00:00+05:30",
    "2027-01-26T12:00:00+05:30", "2027-01-26T13:00:00+05:30",
    "2027-01-26T14:00:00+05:30", "2027-01-26T16:00:00+05:30",
    "2027-01-26T20:00:00+05:30", "2027-01-27T07:00:00+05:30",
    "2027-01-27T08:00:00+05:30"
  ]);
});

test("confirmed names, venue and exact directions are retained", () => {
  const textContent = html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "");
  for (const text of [
    "S/O Mrs. Rekha Gupta and Mr. Ajay Gupta",
    "D/O Mrs. Madhu Sharma and Mr. Harish Kant Sharma",
    "Evara Resort", "Jim Corbett, Uttarakhand"
  ]) assert.ok(textContent.includes(text), text);
  assert.ok(html.includes("https://maps.app.goo.gl/PL4M48uGDFwTjAJs6"));
  assert.doesNotMatch(html, /Varmala|11:00 AM|Palms|Shubh Gupta|Suchita Sharma/);
});

test("new celebrations have matching original illustrations", async () => {
  const artwork = await readFile(new URL("../assets/artwork/ceremonies.svg", import.meta.url), "utf8");
  for (const event of ["jai-mala", "gala-dinner", "vidai"]) {
    assert.ok(html.includes(`data-event="${event}"`));
    assert.match(html, new RegExp(`ceremonies\\.svg(?:\\?[^"#]+)?#${event}"`));
    assert.ok(artwork.includes(`<symbol id="${event}"`));
  }
  assert.doesNotMatch(html, /2027-01-26T(?:16:30|19:00):00/);
});

test("measured figure bounds belong to the exact opening movies and posters", async () => {
  const measurements = JSON.parse(await readFile(new URL("fixtures/opening-bounds.json", import.meta.url), "utf8"));
  for (const name of ["portrait", "landscape"]) {
    const measurement = measurements[name];
    assert.ok(measurement.bounds[1] >= .6, `${name} reserves the upper 60% for text`);
    assert.ok(measurement.bounds[3] <= .96, `${name} retains at least 4% below the figures`);
    assert.equal(measurement.posesMeasured, 162);
    assert.deepEqual(measurement.viewArcDegrees, [150, 225]);
    assert.ok(measurement.maximumWristTargetError < .00002);
    assert.equal(measurement.cameraStageAndLightsUnchanged, true);
    for (const asset of ["movie", "poster", "closedPoster"]) {
      const bytes = await readFile(new URL(`../${measurement[asset]}`, import.meta.url));
      assert.equal(createHash("sha256").update(bytes).digest("hex"), measurement[`${asset}Sha256`]);
    }
  }
});

test("the licensed dancing couple has complete accessible attribution", () => {
  assert.match(html, /<details class="artwork-credit">/);
  assert.match(html, /<summary>Credits<\/summary>/);
  assert.match(html, /https:\/\/www\.thingiverse\.com\/thing:3181273/);
  assert.match(html, /by Timo77/);
  assert.match(html, /https:\/\/creativecommons\.org\/licenses\/by\/4\.0\//);
  assert.match(html, /Adapted with newly authored materials, pose and rig-weight changes/);
  assert.doesNotMatch(html, /para2\.wrl|3dklon/);
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
  assert.ok(html.includes(`href="${prefilledForm.replaceAll("&", "&amp;")}"`));
  assert.doesNotMatch(html, /\/edit|\/Users\/|WhatsApp|reference-contact-sheet/);
  assert.doesNotMatch(html, /<iframe/);
  assert.doesNotMatch(html, /RSVP is not open in this local preview/);
  assert.doesNotMatch(html, /Please follow the|href="#schedule">Schedule/);
});

test("countdown subtitle is removed and music has no autoplay or controls", () => {
  assert.doesNotMatch(html, /countdown__date|4:00 PM IST/);
  assert.match(html, /<audio[^>]+data-src="assets\/audio\/ishq-wala-love-instrumental-v3\.m4a"/);
  assert.doesNotMatch(html, /<audio[^>]+\s(?:controls|autoplay)(?:\s|>)/);
});

test("the approved envelope uses public derivatives, live text and the original form", async () => {
  const artwork = JSON.parse(await readFile(new URL("fixtures/rsvp-artwork.json", import.meta.url), "utf8"));
  for (const asset of artwork.assets) {
    const bytes = await readFile(new URL(`../${asset.path}`, import.meta.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256);
  }
  assert.match(html, /class="rsvp__letter"/);
  assert.match(html, /<h2 id="rsvp-title">Will you join us\?<\/h2>/);
  assert.match(html, /<time datetime="2027-01-26">26 January 2027<\/time>/);
  assert.doesNotMatch(html, /Oreo|Zylo|our humans|approved-concept\.png/i);
  const music = JSON.parse(await readFile(new URL("fixtures/music.json", import.meta.url), "utf8"));
  assert.equal(music.public_use_permission_confirmed_by_user, true);
  assert.equal(music.trimmed_samples_all_zero, true);
  assert.equal(createHash("sha256").update(await readFile(new URL(`../${music.output}`, import.meta.url))).digest("hex"), music.output_sha256);
});

test("rendering assets stay below 1.5 MB and native media never autoplays", async () => {
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
    assert.doesNotMatch(tag, /\sautoplay(?:\s|>|=)/);
  }
});
