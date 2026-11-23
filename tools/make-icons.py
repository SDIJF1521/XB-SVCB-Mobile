"""根据桌面端 Logo 生成 Android 启动图标。

运行：python mobile/tools/make-icons.py
需要 Pillow；只在图标缺失或 Logo 更新后执行一次。
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets" / "icon" / "xb-svcb.png"
RES = ROOT / "mobile" / "android" / "res"

LEGACY = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
FOREGROUND = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}


def circular(image: Image.Image) -> Image.Image:
    size = image.size[0]
    mask = Image.new("L", (size * 4, size * 4), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    mask = mask.resize((size, size), Image.LANCZOS)
    result = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    result.paste(image, (0, 0), mask)
    return result


def main() -> None:
    logo = Image.open(SOURCE).convert("RGBA")

    for density, size in LEGACY.items():
        directory = RES / f"mipmap-{density}"
        directory.mkdir(parents=True, exist_ok=True)
        icon = logo.resize((size, size), Image.LANCZOS)
        icon.save(directory / "ic_launcher.png", optimize=True)
        circular(icon).save(directory / "ic_launcher_round.png", optimize=True)

        foreground_size = FOREGROUND[density]
        canvas = Image.new("RGBA", (foreground_size, foreground_size), (0, 0, 0, 0))
        inner = int(foreground_size * 0.62)
        scaled = logo.resize((inner, inner), Image.LANCZOS)
        offset = (foreground_size - inner) // 2
        canvas.paste(scaled, (offset, offset), scaled)
        canvas.save(directory / "ic_launcher_foreground.png", optimize=True)

    anydpi = RES / "mipmap-anydpi-v26"
    anydpi.mkdir(parents=True, exist_ok=True)
    adaptive = """<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
"""
    (anydpi / "ic_launcher.xml").write_text(adaptive, encoding="utf-8")
    (anydpi / "ic_launcher_round.xml").write_text(adaptive, encoding="utf-8")
    print("icons written to", RES)


if __name__ == "__main__":
    main()
