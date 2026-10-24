# Ascend generated brand assets

Mode: built-in `image_gen` via the imagegen skill. Both assets were generated from reference images, with no API-key or CLI fallback.

## Transparent brand mark

Final file: `dist/assets/ascend-mark.png`.

Reference: the user's small plum classical university icon. Final prompt:

> Use case: logo-brand. Asset type: final production logo for Ascend, a professional college application planner website and native iPhone app. The supplied image is a STYLE/SUBJECT REFERENCE, not an edit target. Create one NEW distinctive mark close to this elegant classical university temple: a clean triangular pediment above three sturdy columns and a two-step plinth. Integrate a subtle ascending step rhythm in the base while retaining near symmetry, architectural balance, and the instantly legible university silhouette. Refined, confident, premium, understated; medium-bold consistent strokes, gently rounded joins, ample internal negative space so it remains legible at 24 pixels. Single flat deep muted plum #574D66 on genuinely transparent background. Center the single isolated mark on a square canvas, occupying about 80% of its width/height with clean even margins. No text, no letters, no wordmark, no frame, no app-icon rounded square, no gradients, no shadows, no textures, no mockup, no extra symbols or variations. Crisp vector-like raster edges. Return the finished transparent PNG brand mark.

## iPhone icon

Final file: `dist/assets/ascend-app-icon.png`. Reference: the generated Ascend brand mark above. Final prompt:

> Create the production iOS app icon using the supplied NEW ASCEND BRAND MARK as the exact foreground identity. Preserve its temple roof, three columns, proportions, color and clean silhouette. Place that same mark, centered and occupying approximately 68% of the image width, on a smooth very subtle pastel lavender #E5DCF2 to mint #E0EEE5 background that matches a premium professional college planner. Square flat full-bleed opaque image with straight square outer edges: iOS will apply its own rounded icon mask. No rounded outer frame, no letters, no text, no added iconography, no mockup, no photograph, no bevels, no dimensional object. Keep the original deep muted plum mark with excellent contrast. Minimal and crisp, elegant, restrained. One finished icon only.

`ios/scripts/icon.swift` performs ordinary Xcode asset preparation: resizing the generated icon to 1024 pixels, flattening alpha for Apple's app-icon requirements, and copying the generated brand mark into the native image catalog. It does not redraw the artwork.
