import os
from pathlib import Path
import numpy as np

# Import validation helper from API module
try:
    from backend.biomedparse_api import _validate_heatmap_npz  # type: ignore
except Exception:
    from biomedparse_api import _validate_heatmap_npz  # type: ignore


def test_validate_heatmap_npz_ok(tmp_path: Path) -> None:
    npz_path = tmp_path / "ok.npz"
    arr = (np.random.rand(4, 4, 4) * 255).astype(np.uint8)
    np.savez_compressed(str(npz_path), prob=arr)
    os.environ["BP_VALIDATE_HEATMAP"] = "1"
    _validate_heatmap_npz(npz_path)


def test_validate_heatmap_npz_missing_key(tmp_path: Path) -> None:
    npz_path = tmp_path / "bad_missing.npz"
    arr = (np.random.rand(4, 4, 4) * 255).astype(np.uint8)
    np.savez_compressed(str(npz_path), notprob=arr)
    os.environ["BP_VALIDATE_HEATMAP"] = "1"
    try:
        _validate_heatmap_npz(npz_path)
    except Exception as e:
        assert "missing" in str(e).lower()
    else:
        raise AssertionError("Expected validation to fail for missing 'prob' key")


def test_validate_heatmap_npz_wrong_dtype(tmp_path: Path) -> None:
    npz_path = tmp_path / "bad_dtype.npz"
    arr = (np.random.rand(4, 4, 4)).astype(np.float32)
    np.savez_compressed(str(npz_path), prob=arr)
    os.environ["BP_VALIDATE_HEATMAP"] = "1"
    try:
        _validate_heatmap_npz(npz_path)
    except Exception as e:
        assert "uint8" in str(e)
    else:
        raise AssertionError("Expected validation to fail for non-uint8 'prob'")


