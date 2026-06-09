import numpy as np

from infrastructure.imaging.color_fidelity import content_mask_from_rgb


def test_pale_blue_fill_counts_as_content_not_background():
    arr = np.full((4, 4, 3), 255, dtype=np.uint8)
    arr[1, 1] = (204, 229, 255)
    mask = content_mask_from_rgb(arr)
    assert mask[1, 1]
    assert not mask[0, 0]


def test_near_white_gray_is_background():
    arr = np.full((2, 2, 3), (252, 253, 254), dtype=np.uint8)
    mask = content_mask_from_rgb(arr)
    assert not mask.any()
