"""Shared, format-aware access to SmartStock pipeline artifacts.

The forecasting workbench historically stored its artifacts in
``Data Forcast/data`` as Excel files while the API expected CSV files in a
root ``data`` directory. Keeping the resolution here makes every consumer
use the same current pipeline output without copying data by hand.
"""
from __future__ import annotations

from pathlib import Path
from typing import Optional

import pandas as pd


ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_DIRECTORIES = (ROOT_DIR / "data", ROOT_DIR / "Data Forcast" / "data")


def artifact_path(name: str, *, include_fixtures: bool = False) -> Optional[Path]:
    """Find an artifact, preferring canonical CSV outputs over legacy Excel."""
    stem = Path(name).stem
    for directory in DATA_DIRECTORIES:
        for suffix in (".csv", ".xlsx"):
            candidate = directory / f"{stem}{suffix}"
            if candidate.is_file():
                return candidate
    if include_fixtures:
        fixture = ROOT_DIR / "tests" / "fixtures" / name
        if fixture.is_file():
            return fixture
    return None


def read_artifact(name: str, *, include_fixtures: bool = False) -> pd.DataFrame:
    """Load a CSV or Excel artifact with a useful error when absent."""
    path = artifact_path(name, include_fixtures=include_fixtures)
    if path is None:
        searched = ", ".join(str(directory) for directory in DATA_DIRECTORIES)
        raise FileNotFoundError(f"{name} not found in: {searched}")
    return pd.read_excel(path) if path.suffix.lower() == ".xlsx" else pd.read_csv(path)
