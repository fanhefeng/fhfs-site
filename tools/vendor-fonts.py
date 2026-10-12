"""Regenerate committed fonts from checksum-verified upstream TTFs, offline.

See docs/FONTS.md. Python fonttools==4.66.1 and brotli==1.2.0 are required.
"""
import argparse
import hashlib
import json
import shutil
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

COMMIT = "bd8f81ddb5c74d5c8897b36ad88b440266245103"
SOURCES = {
    "Nunito": ("nunito", "bb55a5ca5c2042335b3991af27c4d0705d0ef41cac6164ac737fd8f2a1e85207"),
    "JosefinSans": ("josefinsans", "9255abdb5f393bc51e101abbd07a716a977fd3e15472b1b84b260f426a342bfd"),
    "GeistMono": ("geistmono", "d00e590b8eb3a59acc329b2d044fd143ae935090b7da33199ebee27cc7de8196"),
    "NotoSansSC": ("notosanssc", "a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da"),
}


def digest(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source_dir", type=Path)
    parser.add_argument("--prefix", default="")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    web = root / "src/app/font-files"
    og = root / "src/lib/server/og-fonts"
    source_files = {}
    for name, (family, expected) in SOURCES.items():
        file = args.source_dir / f"{args.prefix}{name}.ttf"
        if digest(file) != expected:
            raise ValueError(f"Upstream checksum mismatch: {name}")
        license_file = args.source_dir / f"{args.prefix}{family}-OFL.txt"
        if "SIL OPEN FONT LICENSE Version 1.1" not in license_file.read_text():
            raise ValueError(f"Missing OFL license: {name}")
        source_files[name] = file
    web.mkdir(parents=True, exist_ok=True)
    og.mkdir(parents=True, exist_ok=True)
    latin = (list(range(0x20, 0x250)) + list(range(0x2000, 0x2070))
             + [0x20AC, 0x2122, 0x2191, 0x2193, 0x2212, 0xFEFF, 0xFFFD])
    for name in ("Nunito", "JosefinSans", "GeistMono"):
        font = TTFont(source_files[name], recalcTimestamp=False)
        options = subset.Options()
        options.name_IDs = ["*"]
        sub = subset.Subsetter(options=options)
        sub.populate(unicodes=latin)
        sub.subset(font)
        font.flavor = "woff2"
        font.save(web / f"{name}.woff2")
        font.close()
    for name, weights in (("Nunito", (400, 700)), ("NotoSansSC", (400, 600))):
        for weight in weights:
            font = instantiateVariableFont(
                TTFont(source_files[name], recalcTimestamp=False), {"wght": weight}, inplace=True
            )
            font.flavor = "woff"
            font.save(og / f"{name}-{weight}.woff")
            font.close()
    for name, (family, _) in SOURCES.items():
        source_license = args.source_dir / f"{args.prefix}{family}-OFL.txt"
        if name != "NotoSansSC":
            shutil.copyfile(source_license, web / f"{family}-OFL.txt")
        if name in ("Nunito", "NotoSansSC"):
            shutil.copyfile(source_license, og / f"{family}-OFL.txt")
    artifacts = sorted([*web.glob("*.woff2"), *og.glob("*.woff")])
    manifest = {
        "upstreamCommit": COMMIT,
        "fonttools": "4.66.1",
        "brotli": "1.2.0",
        "sources": [
            {"family": name,
             "url": f"https://raw.githubusercontent.com/google/fonts/{COMMIT}/ofl/{family}/{name}%5Bwght%5D.ttf",
             "sha256": checksum}
            for name, (family, checksum) in SOURCES.items()
        ],
        "files": [{"path": str(file.relative_to(root)), "bytes": file.stat().st_size,
                   "sha256": digest(file)} for file in artifacts],
    }
    (root / "tools/fonts.gen.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Generated {len(artifacts)} local fonts; see tools/fonts.gen.json")


if __name__ == "__main__":
    main()
