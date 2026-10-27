"""Convert the personalizer's bundled photos and option artwork to WebP.

Keeps source dimensions. Artwork with transparency retains its full alpha
channel; small selectable icons use lossless WebP. Run from any directory.
"""

from pathlib import Path

from PIL import Image


PUBLIC = Path(__file__).resolve().parents[1] / "public"
FOLDERS = (
    "assets/acceso",
    "assets/mates",
    "assets/personalizacion",
    "assets/personalizador",
)
EXTENSIONS = {".png", ".jpg", ".jpeg"}


def convert(source: Path) -> Path:
    target = source.with_suffix(".webp")
    with Image.open(source) as image:
        settings = {"format": "WEBP", "method": 6}
        if "iconos" in source.parts:
            settings["lossless"] = True
            settings["exact"] = True
        else:
            settings["quality"] = 92
            settings["alpha_quality"] = 100
            settings["exact"] = True
        if image.info.get("icc_profile"):
            settings["icc_profile"] = image.info["icc_profile"]
        image.save(target, **settings)
    return target


def main() -> None:
    sources = sorted(
        file
        for folder in FOLDERS
        for file in (PUBLIC / folder).rglob("*")
        if file.is_file()
        and file.suffix.lower() in EXTENSIONS
        and not file.name.startswith("matearte-personalizador-og")
    )
    if not sources:
        print("No bundled PNG or JPEG images remain to convert.")
        return
    original_bytes = sum(file.stat().st_size for file in sources)
    targets = [convert(file) for file in sources]
    converted_bytes = sum(file.stat().st_size for file in targets)
    for file in sources:
        file.unlink()
    print(
        f"{len(sources)} images: {original_bytes / 1048576:.1f} MB -> "
        f"{converted_bytes / 1048576:.1f} MB "
        f"({100 * (1 - converted_bytes / original_bytes):.1f}% smaller)"
    )


if __name__ == "__main__":
    main()
