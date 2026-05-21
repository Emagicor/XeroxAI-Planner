def validate_analysis_result(data: dict) -> bool:
    rooms = data.get("rooms")
    if not rooms or not isinstance(rooms, list):
        return False

    required_fields = ("name", "bbox", "area_sqft", "confidence_pct")

    for room in rooms:
        if not all(field in room for field in required_fields):
            return False

        bbox = room.get("bbox")
        if not isinstance(bbox, list) or len(bbox) != 4:
            return False

        if not all(isinstance(value, (int, float)) and 0 <= value <= 1000 for value in bbox):
            return False

        area = room.get("area_sqft")
        if not isinstance(area, (int, float)) or area <= 0:
            return False

    return True
