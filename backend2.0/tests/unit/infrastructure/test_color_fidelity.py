from io import BytesIO

from PIL import Image

from infrastructure.imaging.color_fidelity import composite_on_white, load_rgb


def _rgba_png_bytes() -> bytes:
    img = Image.new("RGBA", (40, 40), (0, 0, 0, 0))
    draw = Image.new("RGBA", (40, 40), (255, 0, 0, 128))
    img = Image.alpha_composite(img, draw)
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_load_rgb_composites_transparency_onto_white_not_black():
    rgb = load_rgb(_rgba_png_bytes())
    assert rgb.mode == "RGB"
    # Center pixel should be pinkish red on white, not dark red on black.
    r, g, b = rgb.getpixel((20, 20))
    assert r > 200
    assert g < 180
    assert b < 180


def test_composite_on_white_corner_is_white():
    rgb = composite_on_white(Image.new("RGBA", (10, 10), (0, 0, 0, 0)))
    assert rgb.getpixel((0, 0)) == (255, 255, 255)
