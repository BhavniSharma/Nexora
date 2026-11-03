import os
import joblib
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.metrics import classification_report

from ml.data.generate_dataset import generate_synthetic_telemetry, DATA_PATH
from ml.preprocessing.pipeline import TelemetryPreprocessor

MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
MODEL_PATH = os.path.join(MODEL_DIR, "isolation_forest.joblib")
SCALER_PATH = os.path.join(MODEL_DIR, "scaler.joblib")


def train_anomaly_model():
    print("--- 1. Loading Training Dataset ---")
    if not os.path.exists(DATA_PATH):
        print(f"Dataset not found. Generating synthetic telemetry...")
        df = generate_synthetic_telemetry(num_samples=2000, anomaly_ratio=0.04)
    else:
        df = pd.read_csv(DATA_PATH)
        print(f"Loaded {len(df)} samples from {DATA_PATH}")

    print("\n--- 2. Extracting Features & Preprocessing ---")
    preprocessor = TelemetryPreprocessor()
    X = preprocessor.fit_transform(df)
    y_true = df["is_anomaly"].values

    print(f"Feature matrix shape: {X.shape}")

    print("\n--- 3. Training Isolation Forest Model ---")
    model = IsolationForest(
        n_estimators=100,
        contamination=0.04,
        max_samples="auto",
        random_state=42,
        n_jobs=-1
    )
    model.fit(X)

    # Predictions: -1 = anomaly, 1 = normal
    raw_preds = model.predict(X)
    y_pred = (raw_preds == -1).astype(int)

    print("\n--- 4. Model Evaluation Summary ---")
    print(classification_report(y_true, y_pred, target_names=["Normal", "Anomaly"]))

    print("--- 5. Saving Serialized Model Artifacts ---")
    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    preprocessor.save(SCALER_PATH)

    print(f"Model saved to:  {os.path.abspath(MODEL_PATH)}")
    print(f"Scaler saved to: {os.path.abspath(SCALER_PATH)}")
    print("\nIsolation Forest Anomaly Detection pipeline trained successfully!")


if __name__ == "__main__":
    train_anomaly_model()
