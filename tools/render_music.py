"""Render the invitation's original instrumental using only Python and macOS audio tools."""

import argparse
from array import array
import math
from pathlib import Path
import random
import shutil
import subprocess
import sys
import tempfile
import wave


RATE = 32000
BEAT = 60 / 75
BARS = 16
FRAMES = round(BARS * 4 * BEAT * RATE)
TAU = math.tau
RANDOM = random.Random(2612027)
LEFT = array("d", [0.0]) * FRAMES
RIGHT = array("d", [0.0]) * FRAMES


def frequency(midi):
    return 440 * 2 ** ((midi - 69) / 12)


def mix(samples, start, gain, pan=0):
    offset = round(start * RATE)
    left_gain = gain * math.sqrt((1 - pan) / 2)
    right_gain = gain * math.sqrt((1 + pan) / 2)
    for index, value in enumerate(samples):
        frame = (offset + index) % FRAMES
        LEFT[frame] += value * left_gain
        RIGHT[frame] += value * right_gain


def pluck(midi, duration=2.2):
    step = TAU * frequency(midi) / RATE
    for frame in range(round(duration * RATE)):
        t = frame / RATE
        attack = 1 - math.exp(-t / 0.004)
        release = min(1, (duration - t) / 0.12)
        phase = step * frame
        tone = (
            math.sin(phase) * math.exp(-t / 0.75)
            + 0.22 * math.sin(phase * 1.002) * math.exp(-t / 0.95)
            + 0.32 * math.sin(phase * 2) * math.exp(-t / 0.34)
            + 0.16 * math.sin(phase * 3) * math.exp(-t / 0.21)
            + 0.07 * math.sin(phase * 4) * math.exp(-t / 0.13)
            + 0.025 * math.sin(phase * 6) * math.exp(-t / 0.07)
        )
        yield tone * attack * release


def flute(midi, duration):
    phase = 0
    breath = 0
    f = frequency(midi)
    for frame in range(round(duration * RATE)):
        t = frame / RATE
        vibrato = 1 + 0.0025 * math.sin(TAU * 4.7 * t) * min(1, t / 0.4)
        scoop = 1 - 0.012 * math.exp(-t / 0.07)
        phase += TAU * f * vibrato * scoop / RATE
        breath = 0.82 * breath + 0.18 * RANDOM.uniform(-1, 1)
        attack = math.sin(min(1, t / 0.11) * math.pi / 2)
        release = math.sin(min(1, (duration - t) / 0.24) * math.pi / 2)
        tone = math.sin(phase) + 0.14 * math.sin(2 * phase) + 0.045 * math.sin(3 * phase)
        yield (tone + 0.07 * breath) * attack * release


def pad(midi, duration):
    step = TAU * frequency(midi) / RATE
    for frame in range(round(duration * RATE)):
        t = frame / RATE
        envelope = math.sin(math.pi * t / duration) ** 1.5
        phase = step * frame
        yield envelope * (
            math.sin(phase) + 0.36 * math.sin(phase * 1.001)
            + 0.14 * math.sin(phase * 2)
        )


def drum(low):
    duration = 0.42 if low else 0.19
    for frame in range(round(duration * RATE)):
        t = frame / RATE
        if low:
            phase = TAU * (65 * t + 18 * 0.035 * (1 - math.exp(-t / 0.035)))
            tone = math.sin(phase) + 0.22 * math.sin(2.42 * phase)
            envelope = math.exp(-t / 0.14)
        else:
            phase = TAU * 220 * t
            tone = math.sin(phase) + 0.45 * math.sin(1.51 * phase) + 0.22 * math.sin(2.35 * phase)
            envelope = math.exp(-t / 0.045)
        yield tone * envelope * min(1, t / 0.003) * min(1, (duration - t) / 0.025)


def shaker():
    previous = 0
    for frame in range(round(0.1 * RATE)):
        t = frame / RATE
        noise = RANDOM.uniform(-1, 1)
        yield (noise - previous) * min(1, t / 0.006) * math.exp(-t / 0.021)
        previous = noise


def compose():
    # A quiet pentatonic melody over open, added-note harmonies; no borrowed tune or samples.
    chords = [
        (50, 57, 64, 66), (50, 57, 64, 66),
        (47, 54, 57, 62), (47, 54, 57, 62),
        (43, 50, 57, 59), (43, 50, 57, 59),
        (45, 52, 59, 62), (45, 52, 59, 62),
        (50, 57, 64, 66), (50, 57, 64, 66),
        (47, 54, 57, 62), (47, 54, 57, 62),
        (43, 50, 54, 59), (43, 50, 54, 59),
        (45, 52, 59, 62), (50, 57, 62, 66),
    ]
    for bar, chord in enumerate(chords):
        origin = bar * 4 * BEAT
        for voice, midi in enumerate(chord):
            mix(pad(midi, 4.8 * BEAT), origin, 0.019, (voice - 1.5) * 0.23)
        for beat, voice in [(0, 0), (0.75, 2), (1.5, 1), (2.5, 3), (3.25, 2)]:
            midi = chord[voice] + (12 if voice else 0)
            mix(pluck(midi), origin + beat * BEAT + RANDOM.uniform(-0.006, 0.006),
                0.12 * RANDOM.uniform(0.88, 1.05), -0.3 if voice % 2 else 0.3)
        if 2 <= bar <= 14:
            for beat in [0, 2.5]:
                mix(drum(True), origin + beat * BEAT, 0.08, -0.1)
            for beat in [1.5, 3]:
                mix(drum(False), origin + beat * BEAT, 0.045, 0.16)
            for half in range(8):
                mix(shaker(), origin + (half / 2 + (0.025 if half % 2 else 0)) * BEAT,
                    0.006 if half % 2 else 0.003, 0.35)

    phrases = {
        2: [(0, 78, 0.9), (1, 76, 0.45), (1.75, 74, 1.25), (3.25, 69, 0.6)],
        3: [(0.25, 71, 0.6), (1, 74, 0.45), (1.75, 76, 1.1), (3, 78, 0.7)],
        4: [(0, 81, 1.1), (1.5, 78, 0.45), (2.25, 76, 0.6), (3, 74, 0.85)],
        5: [(0.5, 76, 0.45), (1.25, 78, 0.6), (2, 71, 0.7), (3, 69, 0.9)],
        8: [(0, 74, 0.65), (0.75, 76, 0.4), (1.5, 78, 0.8), (2.5, 81, 0.85), (3.5, 83, 0.4)],
        9: [(0, 81, 0.85), (1.25, 78, 0.45), (2, 76, 0.8), (3, 74, 0.85)],
        10: [(0.25, 71, 1.0), (1.75, 74, 0.6), (2.5, 76, 0.7), (3.25, 78, 0.6)],
        11: [(0, 76, 0.45), (0.75, 74, 1.2), (2.25, 71, 0.6), (3, 69, 0.9)],
        12: [(0.5, 74, 1.5), (2.5, 69, 0.85)],
        13: [(0.5, 71, 0.6), (1.5, 74, 1.7)],
        15: [(0, 78, 0.6), (1, 76, 0.6), (2, 74, 1.7)],
    }
    for bar, notes in phrases.items():
        for beat, midi, length in notes:
            mix(flute(midi, length * BEAT), (bar * 4 + beat) * BEAT,
                0.11 * RANDOM.uniform(0.94, 1.03), 0.02)
    for bar in [0, 1, 6, 7, 14]:
        for beat, midi in [(0.5, 78), (1.25, 81), (2.25, 76), (3.25, 74)]:
            mix(pluck(midi, 1.6), (bar * 4 + beat) * BEAT, 0.055, -0.2)


def render(output):
    if not shutil.which("afconvert"):
        raise SystemExit("macOS afconvert is required to encode the original soundtrack.")
    compose()
    dry_left = array("d", LEFT)
    dry_right = array("d", RIGHT)
    # Short cross-channel reflections wrap with the score for a click-free loop.
    for delay, gain in [(0.087, 0.12), (0.149, 0.09), (0.227, 0.065), (0.347, 0.04)]:
        offset = round(delay * RATE)
        for frame in range(FRAMES):
            source = (frame - offset) % FRAMES
            LEFT[frame] += dry_right[source] * gain
            RIGHT[frame] += dry_left[source] * gain
    peak = max(max(abs(value) for value in LEFT), max(abs(value) for value in RIGHT))
    scale = 0.48 / peak
    pcm = array("h")
    squares = 0.0
    for left, right in zip(LEFT, RIGHT):
        for value in [left * scale, right * scale]:
            pcm.append(round(value * 32767))
            squares += value * value
    if sys.byteorder != "little":
        pcm.byteswap()
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="invitation-music-") as directory:
        wav_path = Path(directory) / "ivory-evening.wav"
        with wave.open(str(wav_path), "wb") as recording:
            recording.setparams((2, 2, RATE, FRAMES, "NONE", "not compressed"))
            recording.writeframes(pcm.tobytes())
        subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", "96000",
                        "-q", "127", str(wav_path), str(output)], check=True)
    rms = math.sqrt(squares / (FRAMES * 2))
    print(f"Rendered {FRAMES / RATE:.1f}s, peak -6.4 dBFS, RMS {20 * math.log10(rms):.1f} dBFS")
    print(f"{output}: {output.stat().st_size} bytes")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("assets/audio/ivory-evening.m4a"))
    render(parser.parse_args().output)
