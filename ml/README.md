# Plasto classifier

This model classifies a photo as clean PET, dirty film/foam, mixed HDPE, or reject.
It uses a MobileNetV3-Large classifier with a separate plastic/reject gate.

## Setup

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python download_mta.py
.venv/bin/python prepare_dataset.py
```

## Train and export

```bash
.venv/bin/python train.py
.venv/bin/python build_cascade.py
.venv/bin/python evaluate_tflite.py
```

The final float16 TFLite model is in `models/plasto_cascade_mobilenetv3_float16.tflite`.
It takes one `224 x 224` RGB float32 image with pixel values from 0 to 255.

The model has two outputs:

- Four class probabilities in the order stored in `models/metadata.json`
- One plastic probability

If the plastic probability is below the threshold in the metadata, the result is
reject. Otherwise, use the largest of the first three class probabilities.

The exported model scored 94.40% accuracy and 93.18% macro F1 on 411 held-out
images. Dataset sources are separated between train, validation, and test splits.
