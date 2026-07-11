import argparse
import json
import os
import random
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import tensorflow as tf
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.utils.class_weight import compute_class_weight


ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data/processed"
MODELS = ROOT / "models"
REPORTS = ROOT / "reports"
CLASSES = ["clean_pet", "dirty_film_foam", "mixed_hdpe", "reject"]
SEED = 42
IMAGE_SIZE = 192
BATCH_SIZE = 24


def set_seed():
    os.environ["PYTHONHASHSEED"] = str(SEED)
    random.seed(SEED)
    np.random.seed(SEED)
    tf.random.set_seed(SEED)


def get_datasets():
    common = dict(
        image_size=(IMAGE_SIZE, IMAGE_SIZE),
        batch_size=BATCH_SIZE,
        label_mode="int",
        class_names=CLASSES,
    )
    train = tf.keras.utils.image_dataset_from_directory(
        DATA / "train", shuffle=True, seed=SEED, **common
    )
    val = tf.keras.utils.image_dataset_from_directory(
        DATA / "val", shuffle=False, **common
    )
    test = tf.keras.utils.image_dataset_from_directory(
        DATA / "test", shuffle=False, **common
    )
    auto = tf.data.AUTOTUNE
    return (
        train.prefetch(auto),
        val.prefetch(auto),
        test.prefetch(auto),
    )


def build_model():
    augment = tf.keras.Sequential(
        [
            tf.keras.layers.RandomFlip("horizontal"),
            tf.keras.layers.RandomRotation(0.08),
            tf.keras.layers.RandomZoom(0.15),
            tf.keras.layers.RandomContrast(0.15),
            tf.keras.layers.RandomTranslation(0.08, 0.08),
        ],
        name="augmentation",
    )
    base = tf.keras.applications.MobileNetV3Large(
        input_shape=(IMAGE_SIZE, IMAGE_SIZE, 3),
        include_top=False,
        weights="imagenet",
        include_preprocessing=True,
    )
    base.trainable = False
    inputs = tf.keras.Input((IMAGE_SIZE, IMAGE_SIZE, 3), name="image")
    x = augment(inputs)
    x = base(x, training=False)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.Dropout(0.28)(x)
    outputs = tf.keras.layers.Dense(len(CLASSES), activation="softmax", name="classes")(x)
    return tf.keras.Model(inputs, outputs), base


def class_weights():
    labels = []
    for idx, label in enumerate(CLASSES):
        labels.extend([idx] * len(list((DATA / "train" / label).glob("*.jpg"))))
    weights = compute_class_weight(
        class_weight="balanced",
        classes=np.arange(len(CLASSES)),
        y=np.array(labels),
    )
    return {i: float(w) for i, w in enumerate(weights)}


def callbacks():
    return [
        tf.keras.callbacks.ModelCheckpoint(
            MODELS / "best.keras",
            monitor="val_accuracy",
            save_best_only=True,
        ),
        tf.keras.callbacks.EarlyStopping(
            monitor="val_accuracy",
            patience=5,
            restore_best_weights=True,
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.35,
            patience=2,
            min_lr=1e-6,
        ),
    ]


def export_int8(model, train_ds):
    def representative():
        seen = 0
        for images, _ in train_ds:
            for image in images:
                yield [tf.expand_dims(tf.cast(image, tf.float32), 0)]
                seen += 1
                if seen >= 200:
                    return

    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.representative_dataset = representative
    converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
    converter.inference_input_type = tf.uint8
    converter.inference_output_type = tf.uint8
    tflite = converter.convert()
    path = MODELS / "plasto_mobilenetv3_int8.tflite"
    path.write_bytes(tflite)
    return path


def evaluate(model, test_ds, model_path):
    truth = []
    prediction = []
    for images, labels in test_ds:
        probs = model.predict(images, verbose=0)
        truth.extend(labels.numpy().tolist())
        prediction.extend(np.argmax(probs, axis=1).tolist())
    report = classification_report(
        truth,
        prediction,
        labels=list(range(len(CLASSES))),
        target_names=CLASSES,
        output_dict=True,
        zero_division=0,
    )
    matrix = confusion_matrix(truth, prediction, labels=list(range(len(CLASSES))))
    result = {
        "model": str(model_path.relative_to(ROOT)),
        "test_accuracy": report["accuracy"],
        "macro_f1": report["macro avg"]["f1-score"],
        "weighted_f1": report["weighted avg"]["f1-score"],
        "classes": CLASSES,
        "input": [IMAGE_SIZE, IMAGE_SIZE, 3],
        "report": report,
        "confusion_matrix": matrix.tolist(),
        "seed": SEED,
    }
    (REPORTS / "metrics.json").write_text(json.dumps(result, indent=2))

    fig, ax = plt.subplots(figsize=(7, 6))
    image = ax.imshow(matrix, cmap="Blues")
    ax.set_xticks(range(len(CLASSES)), CLASSES, rotation=35, ha="right")
    ax.set_yticks(range(len(CLASSES)), CLASSES)
    ax.set_xlabel("Predicted")
    ax.set_ylabel("Actual")
    for i in range(len(CLASSES)):
        for j in range(len(CLASSES)):
            ax.text(j, i, str(matrix[i, j]), ha="center", va="center")
    fig.colorbar(image, ax=ax)
    fig.tight_layout()
    fig.savefig(REPORTS / "confusion_matrix.png", dpi=160)
    plt.close(fig)
    print(json.dumps({k: result[k] for k in ["test_accuracy", "macro_f1", "weighted_f1"]}, indent=2))
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--head-epochs", type=int, default=12)
    parser.add_argument("--fine-epochs", type=int, default=18)
    args = parser.parse_args()
    MODELS.mkdir(parents=True, exist_ok=True)
    REPORTS.mkdir(parents=True, exist_ok=True)
    set_seed()

    train_ds, val_ds, test_ds = get_datasets()
    model, base = build_model()
    model.compile(
        optimizer=tf.keras.optimizers.Adam(3e-4),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    weights = class_weights()
    model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=args.head_epochs,
        class_weight=weights,
        callbacks=callbacks(),
    )

    base.trainable = True
    for layer in base.layers[:-45]:
        layer.trainable = False
    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-5),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=args.fine_epochs,
        class_weight=weights,
        callbacks=callbacks(),
    )

    best = tf.keras.models.load_model(MODELS / "best.keras")
    result = evaluate(best, test_ds, MODELS / "best.keras")
    model_path = export_int8(best, train_ds)
    metadata = {
        "model_file": model_path.name,
        "labels": CLASSES,
        "business_mapping": {
            "clean_pet": "A",
            "mixed_hdpe": "B",
            "dirty_film_foam": "C",
            "reject": None,
        },
        "input_size": IMAGE_SIZE,
        "input_dtype": "uint8",
        "output_dtype": "uint8",
        "test_accuracy": result["test_accuracy"],
    }
    (MODELS / "metadata.json").write_text(json.dumps(metadata, indent=2))
    print(f"TFLite model: {model_path} ({model_path.stat().st_size / 1024 / 1024:.2f} MB)")


if __name__ == "__main__":
    main()
