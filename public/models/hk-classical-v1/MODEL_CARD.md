# Classical Hong Kong tile detector

No production weights are installed yet. The manifest deliberately declares `available: false`, so the app will not fabricate camera detections.

Before changing it to `true`, add a license-approved, quantized ONNX model and document:

- physical-image dataset provenance and consent;
- pretrained checkpoint and code licenses;
- train/validation/test split by recording session and physical tile set;
- per-class precision, recall, F1 and confusion matrix;
- stabilized whole-hand exact-match accuracy;
- discard-event precision/recall and false events per hour;
- Android Chrome and iPhone Safari inference measurements;
- SHA-256 of the exact deployed model.

Required release gates are in `docs/MOBILE_HK_MAHJONG_CAMERA_COACH_AGENT_BRIEF.md`.

