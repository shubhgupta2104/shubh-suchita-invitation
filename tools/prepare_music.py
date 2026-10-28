"""Prepare the user-authorised wedding excerpt without changing the source recording."""

import argparse
from array import array
import math
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import wave


RATE = 32000
START_SECONDS = 18
END_SECONDS = 79
FADE_SECONDS = 2


def prepare(source, output):
    if not shutil.which("afconvert"):
        raise SystemExit("macOS afconvert is required to prepare the soundtrack.")
    if source.resolve() == output.resolve():
        raise SystemExit("The output must not overwrite the supplied recording.")

    with tempfile.TemporaryDirectory(prefix="invitation-excerpt-") as directory:
        decoded = Path(directory) / "source.wav"
        excerpt = Path(directory) / "excerpt.wav"
        subprocess.run(["afconvert", "-f", "WAVE", "-d", f"LEI16@{RATE}", "-c", "2",
                        str(source), str(decoded)], check=True)
        with wave.open(str(decoded), "rb") as recording:
            if recording.getsampwidth() != 2 or recording.getnchannels() != 2 or recording.getframerate() != RATE:
                raise ValueError("Expected 16-bit stereo PCM at the requested sample rate.")
            if recording.getnframes() < END_SECONDS * RATE:
                raise ValueError("The supplied recording does not contain the full requested excerpt.")
            recording.setpos(START_SECONDS * RATE)
            samples = array("h", recording.readframes((END_SECONDS - START_SECONDS) * RATE))
        if sys.byteorder != "little":
            samples.byteswap()
        peak = max(abs(sample) for sample in samples) / 32768
        rms = math.sqrt(sum((sample / 32768) ** 2 for sample in samples) / len(samples))
        if peak == 0 or rms == 0:
            raise ValueError("The requested excerpt contains only silence.")
        gain = min(0.48 / peak, 0.1 / rms)
        frames = len(samples) // 2
        fade_frames = FADE_SECONDS * RATE
        for frame in range(frames):
            envelope = min(1, frame / fade_frames, (frames - 1 - frame) / fade_frames)
            envelope = math.sin(envelope * math.pi / 2) ** 2
            for channel in range(2):
                position = frame * 2 + channel
                samples[position] = round(samples[position] * gain * envelope)
        if sys.byteorder != "little":
            samples.byteswap()
        with wave.open(str(excerpt), "wb") as recording:
            recording.setparams((2, 2, RATE, frames, "NONE", "not compressed"))
            recording.writeframes(samples.tobytes())
        output.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", "80000",
                        "-q", "127", str(excerpt), str(output)], check=True)
    print(f"Prepared {START_SECONDS}s to {END_SECONDS}s: {frames / RATE:.1f}s, {FADE_SECONDS}s fades")
    print(f"Source peak {peak:.4f}, source RMS {rms:.4f}, applied gain {gain:.4f}")
    print(f"{output}: {output.stat().st_size} bytes")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--output", type=Path, default=Path("assets/audio/vaaroon-forever.m4a"))
    arguments = parser.parse_args()
    prepare(arguments.source, arguments.output)
