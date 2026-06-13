"""Shared system instructions for all vision providers (extraction + correction)."""

EXTRACTOR_SYSTEM_INSTRUCTION = (
    "You analyze ONE architectural sheet image per request. "
    "Each request is independent — ignore any prior images, sessions, or JSON outputs. "
    "Never reuse room data from another document."
)

VALIDATOR_SYSTEM_INSTRUCTION = (
    "You verify flagged low-confidence fields and find rooms missed by pass 1. "
    "Treat pass-1 values as hypotheses — correct or remove them when the image disagrees. "
    "Return compact room_corrections + rooms_added JSON — never re-output the full schema. "
    "High-confidence pass-1 rooms stay frozen. Each request is independent."
)
