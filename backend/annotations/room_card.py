from PIL import ImageDraw

from annotations.fonts import get_font


def _confidence_color(confidence_pct: int) -> tuple:
    if confidence_pct >= 80:
        return (16, 110, 86, 255)
    if confidence_pct >= 50:
        return (133, 79, 11, 255)
    return (153, 60, 29, 255)


def draw_room_card(
    draw: ImageDraw.ImageDraw,
    room: dict,
    cx: int,
    cy: int,
    color: tuple,
    width: int,
    height: int,
) -> None:
    padding = 8
    line_height = 18
    name = str(room.get("name", "Room"))
    length_ft = room.get("length_ft", 0)
    width_ft = room.get("width_ft", 0)
    area_sqft = room.get("area_sqft", 0)
    confidence_pct = int(room.get("confidence_pct", 0))
    dimension_source = str(room.get("dimension_source", "unknown"))

    font_name = get_font(16, bold=True)
    font_medium = get_font(14, bold=True)
    font_small = get_font(13, bold=False)

    lines = [
        (name, font_name, (255, 255, 255, 255)),
        (f"{length_ft} x {width_ft} ft", font_medium, (255, 255, 255, 255)),
        (f"{area_sqft} sqft", font_medium, (255, 255, 255, 255)),
        (f"{confidence_pct}% confidence", font_small, _confidence_color(confidence_pct)),
        (f"[{dimension_source}]", font_small, (255, 255, 255, 178)),
    ]

    text_widths = []
    for text, font, _ in lines:
        bbox = draw.textbbox((0, 0), text, font=font)
        text_widths.append(bbox[2] - bbox[0])

    card_w = max(text_widths) + 2 * padding + 4
    card_h = 2 * padding + 5 * line_height + 4
    card_x = max(0, min(int(cx - card_w / 2), width - card_w))
    card_y = max(0, min(int(cy - card_h / 2), height - card_h))

    draw.rectangle(
        [card_x, card_y, card_x + card_w, card_y + card_h],
        fill=(*color, 210),
        outline=(255, 255, 255, 255),
    )

    divider_y = card_y + padding + line_height
    draw.line(
        [(card_x + padding, divider_y), (card_x + card_w - padding, divider_y)],
        fill=(255, 255, 255, 178),
        width=1,
    )

    y = card_y + padding
    for i, (text, font, text_color) in enumerate(lines):
        if i == 1:
            y = divider_y + 4
        draw.text((card_x + padding, y), text, font=font, fill=text_color)
        y += line_height
