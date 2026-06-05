"""Unit tests for PDF page classification."""
from domain.entities.job import PageType
from pipelines.processing.page_classifier import (
    classify_page,
    classify_page_from_text,
    should_skip_before_vision,
)


def test_classify_cover_from_text():
    text = "PROJECT TITLE SHEET\nDrawing Index\nIssue Date 2024"
    assert classify_page_from_text(text) == PageType.COVER


def test_classify_floorplan_from_text():
    text = "FIRST FLOOR PLAN\nLevel 1\nArchitectural Plan A-101"
    assert classify_page_from_text(text) == PageType.FLOORPLAN


def test_skip_cover_first_page_multi_pdf():
    page_type, reason = classify_page(
        page_number=1,
        total_pages=5,
        pdf_text="ACME RESIDENCE\nPrepared by Architect",
    )
    assert page_type == PageType.COVER
    assert should_skip_before_vision(page_type)
    assert "first page" in reason.lower() or "cover" in reason.lower() or "title" in reason.lower()


def test_single_page_defaults_to_floorplan():
    page_type, _ = classify_page(page_number=1, total_pages=1, pdf_text="")
    assert page_type == PageType.FLOORPLAN


def test_notes_page_skipped():
    text = "GENERAL NOTES\nSpecifications\nAbbreviations and symbols"
    assert classify_page_from_text(text) == PageType.NOTES
    assert should_skip_before_vision(PageType.NOTES)
