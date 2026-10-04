from pathlib import Path
from urllib.request import urlretrieve
from zipfile import ZipFile


URL = (
    "https://zenodo.org/api/records/17899584/files/"
    "malaysian-trash-annotation.v5-build-20251211.coco-segmentation.zip/content"
)
ROOT = Path(__file__).resolve().parent
ZIP_PATH = ROOT / "data/raw/mta.zip"
OUT = ROOT / "data/raw/mta"


def show_progress(blocks: int, block_size: int, total: int):
    downloaded = min(blocks * block_size, total)
    percent = downloaded * 100 / total if total else 0
    print(f"\rDownloading MTA: {percent:5.1f}%", end="", flush=True)


def main():
    ZIP_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not ZIP_PATH.exists():
        urlretrieve(URL, ZIP_PATH, show_progress)
        print()
    else:
        print("MTA zip already downloaded")

    marker = OUT / ".extracted"
    if not marker.exists():
        OUT.mkdir(parents=True, exist_ok=True)
        with ZipFile(ZIP_PATH) as zf:
            zf.extractall(OUT)
        marker.write_text("ok\n")
        print(f"Extracted to {OUT}")
    else:
        print("MTA already extracted")


if __name__ == "__main__":
    main()
