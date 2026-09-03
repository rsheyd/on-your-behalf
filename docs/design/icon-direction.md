# OYB Icon Direction

## Concept

The OYB icon is a “proxy mark”: a small origin spark sends an energetic curved ribbon forward, and that movement resolves into a bold checkmark. It represents a person’s intent being carried forward into a completed action—the central idea behind “On Your Behalf.”

The symbol deliberately avoids a literal form, document, cursor, robot, hand, or person. Those images describe implementation details or produce a generic browser-utility look; the proxy mark instead gives OYB a compact identity that can extend beyond any one kind of form.

## Visual character

The mark should feel capable, energetic, and slightly playful without becoming cute or informal. Its geometry is simple and bold, with one dominant silhouette and generous space around it so the idea remains legible at Chrome’s 16-pixel toolbar size.

The deep plum tile distinguishes OYB from the blue utility icons used by nearby projects. The coral-to-gold motion mark provides warmth, forward energy, and strong contrast. The bright check is the visual destination, while the dot and curved path make completion feel delegated rather than static.

## Design constraints

- Preserve the origin-dot, forward ribbon, and checkmark relationship.
- Prefer a single bold silhouette over small interior details.
- Keep strong contrast and generous margins for 16-pixel rendering.
- Avoid text, initials, literal forms, documents, browser windows, cursors, shields, and generic checklist imagery.
- Avoid thin strokes, busy backgrounds, photorealism, and effects that become muddy when reduced.
- Future variations may refine geometry or color, but should retain the idea of intent moving into completed action.

## Assets and production

The current source artwork is [`../../icons/source/oyb-icon-v2.png`](../../icons/source/oyb-icon-v2.png). It was generated as a flat, vector-like square logo with the built-in image-generation tool, then resized to the 16, 32, 48, and 128-pixel PNG files referenced by `manifest.json`.

The generation brief called for a distinctive delegated-action symbol, a rounded app-icon tile, crisp geometric construction, no text, and a maximum of three principal colors. Small-size inspection confirmed that the motion curve and check remain recognizable at the toolbar scale.
