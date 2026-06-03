def scale_coord(coord: float, dimension: int) -> int:
    return int(coord / 1000 * dimension)


def shrink_polygon(pts: list, amount: int) -> list:
    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    result = []

    for px, py in pts:
        dx, dy = cx - px, cy - py
        dist = (dx**2 + dy**2) ** 0.5
        if dist < 1:
            result.append((int(px), int(py)))
            continue
        move = min(amount, dist)
        new_x = px + dx / dist * move
        new_y = py + dy / dist * move
        result.append((int(new_x), int(new_y)))

    return result
