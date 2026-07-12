import json
from pathlib import Path

import numpy as np
import tensorflow as tf
from PIL import Image
from sklearn.metrics import accuracy_score, f1_score

from train import CLASSES, DATA, IMAGE_SIZE, MODELS, REPORTS


def dequantize(value, details):
    scale, zero = details["quantization"]
    if scale == 0:
        return value.astype(np.float32)
    return (value.astype(np.float32) - zero) * scale


def main():
    metadata_path = MODELS / "metadata.json"
    metadata = json.loads(metadata_path.read_text())
    model_path = MODELS / metadata["model_file"]
    resolver = tf.lite.experimental.OpResolverType.BUILTIN_REF
    interpreter = tf.lite.Interpreter(
        model_path=str(model_path),
        experimental_op_resolver_type=resolver,
    )
    interpreter.allocate_tensors()
    input_info = interpreter.get_input_details()[0]
    output_info = interpreter.get_output_details()
    class_output = next(item for item in output_info if item["shape"][-1] == 4)
    gate_output = next(item for item in output_info if item["shape"][-1] == 1)

    threshold = metadata["plastic_threshold"]
    truth = []
    predicted = []

    for class_number, class_name in enumerate(CLASSES):
        for image_path in sorted((DATA / "test" / class_name).glob("*.jpg")):
            with Image.open(image_path) as image:
                image = image.convert("RGB").resize((IMAGE_SIZE, IMAGE_SIZE))
                input_data = np.expand_dims(
                    np.asarray(image, dtype=input_info["dtype"]), 0
                )
            interpreter.set_tensor(input_info["index"], input_data)
            interpreter.invoke()
            class_probs = dequantize(
                interpreter.get_tensor(class_output["index"]), class_output
            )[0]
            plastic_prob = dequantize(
                interpreter.get_tensor(gate_output["index"]), gate_output
            )[0][0]
            result = int(np.argmax(class_probs[:3])) if plastic_prob >= threshold else 3
            truth.append(class_number)
            predicted.append(result)

    accuracy = accuracy_score(truth, predicted)
    macro_f1 = f1_score(truth, predicted, average="macro")
    report = {
        "model": model_path.name,
        "test_samples": len(truth),
        "test_accuracy": accuracy,
        "test_macro_f1": macro_f1,
        "plastic_threshold": threshold,
    }
    (REPORTS / "tflite_metrics.json").write_text(json.dumps(report, indent=2))
    metadata["exported_test_accuracy"] = accuracy
    metadata["exported_test_macro_f1"] = macro_f1
    metadata_path.write_text(json.dumps(metadata, indent=2))
    print(json.dumps(report, indent=2))

    if accuracy < 0.9:
        raise SystemExit("Quantized model accuracy is below 90%")


if __name__ == "__main__":
    main()
