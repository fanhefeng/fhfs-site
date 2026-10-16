"""Rebuild the pinned Resource Han Rounded subsets offline into an empty directory.

python tools/vendor-rounded.py <source-directory> <empty-output-directory>
See docs/FONTS.md. Ordinary installs and builds never run this tool.
"""
from concurrent.futures import ProcessPoolExecutor
import hashlib
import json
from pathlib import Path
import sys

import brotli
import fontTools
from fontTools import subset
from fontTools.cffLib.CFF2ToCFF import convertCFF2ToCFF
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont


ROOT = Path(__file__).resolve().parents[1]
RECIPE = ROOT / "tools/rounded.gen.json"


def sha(data):
    return hashlib.sha256(data).hexdigest()


def ranges(text):
    groups = []
    for point in sorted(map(ord, text)):
        if groups and point == groups[-1][1] + 1:
            groups[-1][1] = point
        else:
            groups.append([point, point])
    return ",".join(f"U+{a:X}" + (f"-{b:X}" if a != b else "") for a, b in groups)


def renamed(font, style):
    # Retain copyright/license/author fields, but give the derived subsets a
    # distinct family and PostScript name (OFL Reserved Font Name requirement).
    names = {
        1: "FHFS Rounded SC", 2: style, 3: f"FHFSRoundedSC-1910-{style}",
        4: f"FHFS Rounded SC {style}", 6: f"FHFSRoundedSC-{style}",
        16: "FHFS Rounded SC", 17: style,
    }
    for entry in font["name"].names:
        if entry.nameID in names:
            entry.string = names[entry.nameID].encode(entry.getEncoding())
    if "CFF " in font:
        cff = font["CFF "].cff
        cff.fontNames = [names[6]]
        cff.topDictIndex[0].FamilyName = names[1]
        cff.topDictIndex[0].FullName = names[4]


def make_font(source, characters, weight=None):
    font = TTFont(source, recalcTimestamp=False)
    options = subset.Options()
    options.name_IDs = ["*"]
    options.recalc_timestamp = False
    worker = subset.Subsetter(options=options)
    worker.populate(unicodes=map(ord, characters))
    worker.subset(font)
    axes = {"ROND": 100}
    if weight is not None:
        axes["wght"] = weight
    instantiateVariableFont(font, axes, inplace=True, optimize=weight is None)
    if weight is not None:
        # Satori needs static CFF1/TrueType; browsers can use variable CFF2.
        convertCFF2ToCFF(font)
        # The converter writes CID names into CFF while other tables retain
        # their pre-conversion names until serialization (as in its own CLI).
        font.recalcBBoxes = False
    renamed(font, "Regular" if weight is None else str(weight))
    return font


def record(path, relative):
    data = path.read_bytes()
    return {"file": relative, "bytes": len(data), "sha256": sha(data)}


def build_web(job):
    source, output, index, characters = job
    font = make_font(source, characters)
    relative = f"fonts/cn-{index:03}.woff2"
    destination = output / relative
    font.flavor = "woff2"
    font.save(destination)
    font.close()
    return record(destination, relative)


def build_og(source, output, characters):
    records = []
    for weight in (400, 600):
        font = make_font(source, characters, weight)
        relative = f"og/RoundedSC-{weight}.woff"
        destination = output / relative
        font.flavor = "woff"
        font.save(destination)
        font.close()
        records.append(record(destination, relative))
    return records


def build(source, output, recipe):
    (output / "fonts").mkdir(parents=True)
    (output / "og").mkdir()
    font_source = source / recipe["source"]["file"]
    jobs = [(font_source, output, i, text) for i, text in enumerate(recipe["chunks"])]
    with ProcessPoolExecutor(max_workers=4) as workers:
        records = list(workers.map(build_web, jobs))
    records += build_og(font_source, output, "".join(recipe["chunks"]))
    css = [
        "/* Generated from Resource Han Rounded CN v1.910 (SIL OFL 1.1).",
        " * Pinned source, toolchain and character plan: tools/rounded.gen.json. */", "",
    ]
    for index, text in enumerate(recipe["chunks"]):
        url = f'/fonts/rounded/{recipe["folder"]}/cn-{index:03}.woff2'
        css.append(
            '@font-face{font-family:"FHFS Rounded SC";'
            f'src:url("{url}") format("woff2");'
            'font-style:normal;font-display:swap;font-weight:200 900;'
            f'unicode-range:{ranges(text)};}}'
        )
    (output / "rounded.css").write_text("\n".join(css) + "\n")
    license_bytes = (source / recipe["license"]["file"]).read_bytes()
    for directory in ("fonts", "og"):
        (output / directory / "LICENSE.txt").write_bytes(license_bytes)
    return records


def main():
    if len(sys.argv) != 3:
        raise ValueError("Usage: python tools/vendor-rounded.py <source-directory> <empty-output-directory>")
    source, output = (Path(value).resolve() for value in sys.argv[1:])
    recipe = json.loads(RECIPE.read_text())
    if fontTools.__version__ != recipe["fonttools"] or brotli.__version__ != recipe["brotli"]:
        raise ValueError("Use the exact tool versions pinned in the recipe")
    for item in (recipe["source"], recipe["license"]):
        if sha((source / item["file"]).read_bytes()) != item["sha256"]:
            raise ValueError(f'Source checksum mismatch: {item["file"]}')
    characters = "".join(recipe["chunks"])
    if (recipe["version"] != 1 or len(characters) != recipe["charset"]["count"]
            or len(set(characters)) != len(characters)
            or any(not text or len(text) > 200 for text in recipe["chunks"])
            or any(ord(char) < 0x2E80 for char in characters)
            or sha("".join(sorted(characters)).encode()) != recipe["charset"]["sha256"]):
        raise ValueError("Character plan differs from the pinned inventory")
    with TTFont(source / recipe["source"]["file"]) as font:
        if set(map(ord, characters)) != {cp for cp in font.getBestCmap() if cp >= 0x2E80}:
            raise ValueError("Character plan must cover the source CJK inventory exactly")
    if output.exists() and any(output.iterdir()):
        raise ValueError("Output must be a new or empty staging directory")
    records = build(source, output, recipe)
    if records != recipe["outputs"]:
        raise ValueError("Generated font bytes differ from the pinned output hashes")
    print(f"Verified {len(records)} reproducible fonts; review staging output before copying.")


if __name__ == "__main__":
    main()
