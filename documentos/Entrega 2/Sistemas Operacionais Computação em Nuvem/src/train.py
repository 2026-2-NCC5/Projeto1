import os
import sys
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
import joblib

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(BASE_DIR, "data", "dataset_sisa.csv")
MODEL_DIR = os.path.join(BASE_DIR, "models")
MODEL_PATH = os.path.join(MODEL_DIR, "modelo_churn.pkl")

print(f"[INFO] A ler dataset de: {DATA_PATH}")
df = pd.read_csv(DATA_PATH)
print(f"[INFO] Shape do dataset: {df.shape}")
print(f"[INFO] Distribuição da classe 'evadiu':\n{df['evadiu'].value_counts()}\n")

TARGET = "evadiu"
FEATURES = [c for c in df.columns if c != TARGET]

X = df[FEATURES]
y = df[TARGET]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.20, random_state=42, stratify=y
)
print(f"[INFO] Treino: {X_train.shape[0]} amostras | Teste: {X_test.shape[0]} amostras")

model = RandomForestClassifier(
    n_estimators=100,
    max_depth=5,
    class_weight="balanced",
    random_state=42,
)
model.fit(X_train, y_train)
print("[INFO] Modelo treinado com sucesso.\n")

y_pred = model.predict(X_test)
print("=== Classification Report ===")
print(classification_report(y_test, y_pred, zero_division=0))
print("=== Confusion Matrix ===")
print(confusion_matrix(y_test, y_pred))

importances = pd.Series(model.feature_importances_, index=FEATURES).sort_values(ascending=False)
print("\n=== Feature Importances ===")
print(importances.to_string())

os.makedirs(MODEL_DIR, exist_ok=True)
joblib.dump(model, MODEL_PATH)
print(f"\n[OK] Modelo guardado em: {MODEL_PATH}")
