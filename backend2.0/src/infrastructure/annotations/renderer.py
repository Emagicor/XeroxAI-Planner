from io import BytesIO

from PIL import Image, ImageDraw

from config.constants import ROOM_COLORS
from infrastructure.annotations.geometry import scale_coord, shrink_polygon
from infrastructure.annotations.room_card import draw_room_card
from infrastructure.imaging.color_fidelity import composite_on_white, open_image

ANNOTATED_JPEG_QUALITY = 95


def _draw_polygon_room(draw, room, color, width, height):
    polygon = room.get("polygon") or []
    pixel_pts = [
        (scale_coord(p[0], width), scale_coord(p[1], height))
        for p in polygon
        if isinstance(p, (list, tuple)) and len(p) >= 2
    ]
    if len(pixel_pts) < 3:
        return

    draw.polygon(pixel_pts, fill=(*color, 45))
    for shrink in (0, 1, 2):
        draw.polygon(
            shrink_polygon(pixel_pts, shrink),
            outline=(*color, 230),
            fill=None,
        )

    cx = int(sum(p[0] for p in pixel_pts) / len(pixel_pts))
    cy = int(sum(p[1] for p in pixel_pts) / len(pixel_pts))
    draw_room_card(draw, room, cx, cy, color, width, height)


def _draw_bbox_room(draw, room, color, width, height):
    bbox = room.get("bbox") or []
    if not isinstance(bbox, list) or len(bbox) != 4:
        return

    x1 = scale_coord(bbox[0], width)
    y1 = scale_coord(bbox[1], height)
    x2 = scale_coord(bbox[2], width)
    y2 = scale_coord(bbox[3], height)

    draw.rectangle([x1, y1, x2, y2], fill=(*color, 45))
    for offset in (0, 1, 2):
        draw.rectangle(
            [x1 + offset, y1 + offset, x2 - offset, y2 - offset],
            outline=(*color, 230),
            fill=None,
        )

    draw_room_card(draw, room, (x1 + x2) // 2, (y1 + y2) // 2, color, width, height)


def draw_annotations(image_bytes: bytes, rooms: list) -> bytes:
    """Draw colored room overlays on the original page image (0–1000 coords)."""
    base = composite_on_white(open_image(image_bytes)).convert("RGBA")
    width, height = base.size
    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    for i, room in enumerate(rooms):
        color = ROOM_COLORS[i % len(ROOM_COLORS)]
        polygon = room.get("polygon") or []

        if isinstance(polygon, list) and len(polygon) >= 3:
            _draw_polygon_room(draw, room, color, width, height)
        else:
            _draw_bbox_room(draw, room, color, width, height)

    composite = Image.alpha_composite(base, overlay).convert("RGB")
    buffer = BytesIO()
    composite.save(
        buffer,
        format="JPEG",
        quality=ANNOTATED_JPEG_QUALITY,
        subsampling=0,
        optimize=True,
    )
    return buffer.getvalue()
