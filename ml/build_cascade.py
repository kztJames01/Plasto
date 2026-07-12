import hashlib
import json

import numpy as np
import tensorflow as tf
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score

from train import BATCH_SIZE, CLASSES, DATA, IMAGE_SIZE, MODELS, REPORTS


def load_split(name: str, shuffle=False):
    return tf.keras.utils.image_dataset_from_directory(
        DATA / name,
        image_size=(IMAGE_SIZE, IMAGE_SIZE),
        batch_size=BATCH_SIZE,
        label_mode="int",
        class_names=CLASSES,
        shuffle=shuffle,
        seed=42 if shuffle else None,
    ).prefetch(tf.data.AUTOTUNE)


def extract(feature_model, class_model, dataset):
    features = []
    probabilities = []
    labels = []
    for images, batch_labels in dataset:
        features.append(feature_model.predict(images, verbose=0))
        probabilities.append(class_model.predict(images, verbose=0))
        labels.extend(batch_labels.numpy().tolist())
    return np.concatenate(features), np.concatenate(probabilities), np.array(labels)


def cascade_predictions(class_probs, plastic_probs, threshold):
    plastic_class = np.argmax(class_probs[:, :3], axis=1)
    return np.where(plastic_probs >= threshold, plastic_class, 3)


def export_model(model):
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.target_spec.supported_types = [tf.float16]
    path = MODELS / "plasto_cascade_mobilenetv3_float16.tflite"
    path.write_bytes(converter.convert())
    return path


def main():
    class_model = tf.keras.models.load_model(MODELS / "best.keras")
    embedding_layer = class_model.layers[-2]
    feature_model = tf.keras.Model(class_model.input, embedding_layer.output)

    train = extract(feature_model, class_model, load_split("train"))
    val = extract(feature_model, class_model, load_split("val"))
    test = extract(feature_model, class_model, load_split("test"))
    train_x, _, train_y = train
    val_x, val_class_probs, val_y = val
    test_x, test_class_probs, test_y = test
    train_binary = (train_y != 3).astype(int)
    val_binary = (val_y != 3).astype(int)

    best = None
    for c in [0.01, 0.03, 0.1, 0.3, 1.0, 3.0, 10.0]:
        gate = LogisticRegression(
            C=c,
            class_weight="balanced",
            max_iter=3000,
            random_state=42,
        )
        gate.fit(train_x, train_binary)
        val_plastic = gate.predict_proba(val_x)[:, 1]
        for threshold in np.arange(0.10, 0.901, 0.005):
            predicted = cascade_predictions(val_class_probs, val_plastic, threshold)
            accuracy = accuracy_score(val_y, predicted)
            macro_f1 = f1_score(val_y, predicted, average="macro")
            candidate = (accuracy, macro_f1, gate, float(threshold), c)
            if best is None or candidate[:2] > best[:2]:
                best = candidate

    val_accuracy, val_f1, gate, threshold, c = best
    test_plastic = gate.predict_proba(test_x)[:, 1]
    test_predicted = cascade_predictions(test_class_probs, test_plastic, threshold)
    test_accuracy = accuracy_score(test_y, test_predicted)
    test_f1 = f1_score(test_y, test_predicted, average="macro")
    report = {
        "method": "shared-backbone binary reject gate and three-class plastic head",
        "classes": CLASSES,
        "gate_c": c,
        "plastic_threshold": threshold,
        "validation_accuracy": val_accuracy,
        "validation_macro_f1": val_f1,
        "test_accuracy": test_accuracy,
        "test_macro_f1": test_f1,
    }
    (REPORTS / "cascade_metrics.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))

    gate_output = tf.keras.layers.Dense(
        1, activation="sigmoid", name="plastic_gate"
    )(embedding_layer.output)
    combined = tf.keras.Model(
        class_model.input,
        {"class_probabilities": class_model.output, "plastic_probability": gate_output},
    )
    combined.get_layer("plastic_gate").set_weights(
        [gate.coef_.T.astype(np.float32), gate.intercept_.astype(np.float32)]
    )
    model_path = export_model(combined)
    metadata = {
        "model_file": model_path.name,
        "model_sha256": hashlib.sha256(model_path.read_bytes()).hexdigest(),
        "labels": CLASSES,
        "plastic_threshold": threshold,
        "business_mapping": {
            "clean_pet": "A",
            "mixed_hdpe": "B",
            "dirty_film_foam": "C",
            "reject": None,
        },
        "input_size": IMAGE_SIZE,
        "input_dtype": "float32",
        "output_dtype": "float32",
        "outputs": {
            "class_probabilities": 4,
            "plastic_probability": 1,
        },
        "decision": "if plastic_probability is below the threshold, reject; otherwise use the highest of the first three class probabilities",
        "test_accuracy": test_accuracy,
        "test_macro_f1": test_f1,
    }
    (MODELS / "metadata.json").write_text(json.dumps(metadata, indent=2))
    print(f"TFLite model: {model_path} ({model_path.stat().st_size / 1024 / 1024:.2f} MB)")


if __name__ == "__main__":
    main()
