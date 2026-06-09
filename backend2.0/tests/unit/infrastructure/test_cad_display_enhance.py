import numpy as np
from PIL import Image

from infrastructure.imaging.color_fidelity import enhance_cad_markup_visibility
from infrastructure.preprocessing.image_preprocessor import preprocess_image


def test_pale_blue_markup_becomes_more_saturated():
    arr = np.full((8, 8, 3), 255, dtype=np.uint8)
    arr[3, 3] = (215, 235, 255)
    before = Image.fromarray(arr)
    after = np.asarray(enhance_cad_markup_visibility(before))

    assert after[3, 3, 2] > arr[3, 3, 2]
    assert after[3, 3, 2] - after[3, 3, 0] >= 40


def test_white_background_unchanged():
    arr = np.full((4, 4, 3), 255, dtype=np.uint8)
    out = np.asarray(enhance_cad_markup_visibility(Image.fromarray(arr)))
    assert np.array_equal(out, arr)


def test_preprocess_image_pdf_path_boosts_cad_markup():
    arr = np.full((8, 8, 3), 255, dtype=np.uint8)
    arr[2, 2] = (215, 235, 255)
    from io import BytesIO
    from PIL import Image

    buf = BytesIO()
    Image.fromarray(arr).save(buf, format="PNG")
    out_bytes, _ = preprocess_image(buf.getvalue(), preserve_colors=True)
    out = np.asarray(Image.open(BytesIO(out_bytes)).convert("RGB"))
    assert out[2, 2, 2] - out[2, 2, 0] >= 40
