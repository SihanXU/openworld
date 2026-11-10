# Runtime artist regressions

These data were copied from actual DeepSeek NPC orders on 2026-11-03, not authored as ideal icons. Only the original game reference, the first generated icon and the review answer are retained here.

- `sword.json`: call 0004 in the `creation-append` campaign returned `accepted: false` while supplying a repair with all final checks true. The redundant flag described the original and incorrectly discarded a valid repair. Acceptance now derives from final checks and host geometry.
- `armor.json`: call 0008 replaced the original game's angled breastplate silhouette with a sack-shaped icon. Its reference-mask IoU is 0.685; the stricter 0.900 equipment edit contract rejects it and retains the original generated recolor with explicit fallback provenance.

Full requests, model answers, browser messages and rendered comparisons remain in the external `outputs/openworld-workbench/creation-append` evidence directory.
