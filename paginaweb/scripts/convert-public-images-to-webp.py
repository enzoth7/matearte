"""Convert bundled website images to WebP at display-appropriate sizes.

Social sharing images stay in their original format. The Grido JPEG also stays
for metadata consumers, while the visible page can use its WebP counterpart.
"""

from pathlib import Path

from PIL import Image, ImageOps


ASSETS = Path(__file__).resolve().parents[1] / "public" / "assets" / "matearte"
SOURCE_EXTENSIONS = {".png", ".jpg", ".jpeg"}
EXCLUDED_FOLDERS = {"og", "rural"}
KEEP_ORIGINALS = {
    Path("regalos-empresariales/Grido.jpeg"),
    Path("01-marca/email-monogram.png"),
}
COLLIDING_PNGS = {
    Path("01-marca/UruguayNaturalLogo.png"),
    *(Path(f"personalizados-desktop/personalizado-{number:02d}.png") for number in (1, 3, 4, 7, 8, 9, 10)),
}


def is_lossless(path: Path) -> bool:
    relative = path.relative_to(ASSETS)
    return (
        (path.suffix.lower() == ".png" and relative.parts[0] in {"01-marca", "companies"})
        or relative.name in {"PayPal.png", "whatsapp-icon.png", "google.png"}
        or relative == Path("02-seleccion/AUFLogo.png")
        or relative == Path("home-v2/logo.png")
        or relative == Path("home-v2/polarist.png")
        or relative == Path("home-v2/uruguay.png")
        or relative == Path("contact-desktop/whatsapp.png")
    )


def max_long_edge(path: Path) -> int | None:
    relative = path.relative_to(ASSETS)
    folder = relative.parts[0]
    if folder in {"personalizados-desktop", "personalizados-mobile"} and relative.name.startswith("personalizado-"):
        return 1800
    if relative == Path("contact-desktop/local.jpg"):
        return 2200
    if relative == Path("regalos-empresariales/Grido.jpeg"):
        return 3000
    if relative == Path("home-v2/category-regalos.png"):
        return 2200
    if relative == Path("profile-guest-desktop/history.png"):
        return 2200
    if folder == "03-productos":
        return 3000
    return None


def target_for_source(source: Path) -> Path:
    if source.relative_to(ASSETS) in COLLIDING_PNGS:
        return source.with_name(f"{source.stem}-png.webp")
    return source.with_suffix(".webp")


def convert(source: Path) -> Path:
    target = target_for_source(source)
    with Image.open(source) as opened:
        image = ImageOps.exif_transpose(opened)
        has_alpha = "A" in image.getbands() or "transparency" in image.info
        image = image.convert("RGBA" if has_alpha else "RGB")
        limit = max_long_edge(source)
        if limit and max(image.size) > limit:
            image.thumbnail((limit, limit), Image.Resampling.LANCZOS)
        settings = {"format": "WEBP", "method": 6, "exact": True}
        if is_lossless(source):
            settings["lossless"] = True
        else:
            settings["quality"] = 92
            settings["alpha_quality"] = 100
        if opened.info.get("icc_profile"):
            settings["icc_profile"] = opened.info["icc_profile"]
        image.save(target, **settings)

        # Already compressed JPEGs occasionally need a slightly lower quality
        # setting to produce a smaller file. The original dimensions remain.
        if source.suffix.lower() in {".jpg", ".jpeg"} and target.stat().st_size >= source.stat().st_size:
            for quality in (90, 88, 85):
                image.save(target, **{**settings, "quality": quality})
                if target.stat().st_size < source.stat().st_size:
                    break
    return target


def main() -> None:
    sources = sorted(
        file
        for file in ASSETS.rglob("*")
        if file.is_file()
        and file.suffix.lower() in SOURCE_EXTENSIONS
        and file.relative_to(ASSETS).parts[0] not in EXCLUDED_FOLDERS
        and not (file.relative_to(ASSETS) in KEEP_ORIGINALS and file.with_suffix(".webp").exists())
    )
    if not sources:
        print("No PNG or JPEG assets remain to convert.")
        return

    original_bytes = sum(file.stat().st_size for file in sources)
    targets = []
    for index, source in enumerate(sources, 1):
        targets.append(convert(source))
        if index % 30 == 0:
            print(f"Converted {index}/{len(sources)} images", flush=True)

    converted_bytes = sum(file.stat().st_size for file in targets)
    for source in sources:
        if source.relative_to(ASSETS) not in KEEP_ORIGINALS:
            source.unlink()
    print(
        f"{len(sources)} images: {original_bytes / 1048576:.1f} MB -> "
        f"{converted_bytes / 1048576:.1f} MB "
        f"({100 * (1 - converted_bytes / original_bytes):.1f}% smaller)"
    )


if __name__ == "__main__":
    main()
