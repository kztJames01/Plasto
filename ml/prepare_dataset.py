import json
import random
import shutil
from collections import Counter
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent
RAW = ROOT / "data/raw/mta"
OUT = ROOT / "data/processed"
SEED = 42
MIN_BOX = 48

LABEL_MAP = {
    "101_PET_Bottle": "clean_pet",
    "102_HDPE_Plastic": "mixed_hdpe",
    "104_Soft_Plastic": "dirty_film_foam",
    "501_Contaminated": "dirty_film_foam",
    "514_Ikat_Tepi": "dirty_film_foam",
}
CLASSES = ["clean_pet", "mixed_hdpe", "dirty_film_foam", "reject"]


def normalize(name: str) -> str:
    return name.lower().replace(" ", "_").replace("-", "_")


def mapped_label(category_name: str) -> str:
    normalized = normalize(category_name)
    for source, target in LABEL_MAP.items():
        if normalize(source) in normalized or normalized in normalize(source):
            return target
    return "reject"


def find_coco_files():
    files = []
    for path in RAW.rglob("*.json"):
        try:
            data = json.loads(path.read_text())
        except Exception:
            continue
        if "images" in data and "annotations" in data and "categories" in data:
            files.append((path, data))
    return files


def locate_image(coco_path: Path, file_name: str) -> Path | None:
    direct = coco_path.parent / file_name
    if direct.exists():
        return direct
    nearby = coco_path.parent.parent / file_name
    if nearby.exists():
        return nearby
    matches = list(RAW.rglob(Path(file_name).name))
    return matches[0] if matches else None


def split_for_source(source_key: str) -> str:
    value = sum((i + 1) * ord(c) for i, c in enumerate(source_key)) % 100
    if value < 70:
        return "train"
    if value < 85:
        return "val"
    return "test"


def main():
    random.seed(SEED)
    if OUT.exists():
        shutil.rmtree(OUT)
    for split in ["train", "val", "test"]:
        for label in CLASSES:
            (OUT / split / label).mkdir(parents=True, exist_ok=True)

    files = find_coco_files()
    if not files:
        raise SystemExit("No COCO annotation files found. Run download_mta.py first.")

    written = Counter()
    missing = 0
    for coco_path, coco in files:
        categories = {c["id"]: c["name"] for c in coco["categories"]}
        images = {img["id"]: img for img in coco["images"]}
        for idx, ann in enumerate(coco["annotations"]):
            image_info = images.get(ann.get("image_id"))
            category = categories.get(ann.get("category_id"))
            bbox = ann.get("bbox")
            if not image_info or not category or not bbox or len(bbox) != 4:
                continue
            x, y, w, h = [int(round(v)) for v in bbox]
            if w < MIN_BOX or h < MIN_BOX:
                continue
            image_path = locate_image(coco_path, image_info["file_name"])
            if image_path is None:
                missing += 1
                continue
            label = mapped_label(category)
            source_key = f"{coco_path.parent.name}/{image_info['file_name']}"
            split = split_for_source(source_key)
            try:
                with Image.open(image_path) as image:
                    image = image.convert("RGB")
                    pad_x = int(w * 0.12)
                    pad_y = int(h * 0.12)
                    left = max(0, x - pad_x)
                    top = max(0, y - pad_y)
                    right = min(image.width, x + w + pad_x)
                    bottom = min(image.height, y + h + pad_y)
                    crop = image.crop((left, top, right, bottom))
                    name = f"{image_path.stem}_{idx:06d}.jpg"
                    crop.save(OUT / split / label / name, quality=92)
                    written[(split, label)] += 1
            except Exception as exc:
                print(f"Skipped {image_path}: {exc}")

    stats = {
        split: {label: written[(split, label)] for label in CLASSES}
        for split in ["train", "val", "test"]
    }
    for split in ["train", "val", "test"]:
        target_max = max(stats[split][label] for label in CLASSES[:-1])
        reject_dir = OUT / split / "reject"
        reject_files = sorted(reject_dir.glob("*.jpg"))
        random.shuffle(reject_files)
        keep = max(20, target_max * 2)
        for extra in reject_files[keep:]:
            extra.unlink()
        stats[split]["reject"] = min(len(reject_files), keep)

    (OUT / "stats.json").write_text(json.dumps(stats, indent=2))
    print(json.dumps(stats, indent=2))
    print(f"Missing images: {missing}")
    for split in stats:
        for label, count in stats[split].items():
            if count < 20:
                raise SystemExit(f"Too few samples for {split}/{label}: {count}")


if __name__ == "__main__":
    main()
