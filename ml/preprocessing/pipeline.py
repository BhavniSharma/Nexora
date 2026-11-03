import os
import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

FEATURE_NAMES = [
    "cpu", "memory", "disk",
    "cpu_delta", "memory_delta", "disk_delta",
    "cpu_rolling_mean", "memory_rolling_mean", "disk_rolling_mean"
]


class TelemetryPreprocessor:
    def __init__(self):
        self.scaler = StandardScaler()
        self.is_fitted = False

    def extract_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Extract multi-variate sliding statistical features."""
        data = df.copy()

        # Rates of change (delta)
        data["cpu_delta"] = data["cpu"].diff().fillna(0)
        data["memory_delta"] = data["memory"].diff().fillna(0)
        data["disk_delta"] = data["disk"].diff().fillna(0)

        # Rolling window statistics (window=5)
        data["cpu_rolling_mean"] = data["cpu"].rolling(window=5, min_periods=1).mean()
        data["memory_rolling_mean"] = data["memory"].rolling(window=5, min_periods=1).mean()
        data["disk_rolling_mean"] = data["disk"].rolling(window=5, min_periods=1).mean()

        return data[FEATURE_NAMES]

    def fit_transform(self, df: pd.DataFrame) -> np.ndarray:
        features = self.extract_features(df)
        scaled = self.scaler.fit_transform(features)
        self.is_fitted = True
        return scaled

    def transform(self, df: pd.DataFrame) -> np.ndarray:
        if not self.is_fitted:
            raise ValueError("Preprocessor must be fitted before calling transform.")
        features = self.extract_features(df)
        return self.scaler.transform(features)

    def transform_single(self, current: dict, history: list[dict]) -> np.ndarray:
        """Transform a real-time single sample given its recent history."""
        records = list(history) + [current]
        df = pd.DataFrame(records)
        for col in ["cpu", "memory", "disk"]:
            if col not in df.columns:
                df[col] = 0.0

        features = self.extract_features(df)
        latest_row = features.iloc[[-1]]
        return self.scaler.transform(latest_row)

    def save(self, path: str):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        joblib.dump({"scaler": self.scaler, "is_fitted": self.is_fitted}, path)

    @classmethod
    def load(cls, path: str):
        instance = cls()
        data = joblib.load(path)
        instance.scaler = data["scaler"]
        instance.is_fitted = data["is_fitted"]
        return instance
