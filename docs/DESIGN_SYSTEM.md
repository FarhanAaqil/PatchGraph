# PatchGraph Design System Specification

> **Version**: 2.0.0  
> **Brand Identity**: Bold, Graphical, Cybernetic Human-in-the-Loop Workbench  
> **Source Tokens**: `frontend/src/styles/tokens.css`  

---

## 1. Core Color Palette (Exact Hex)

The PatchGraph interface is built on an exact five-tone color harmony:

| Token Name | Hex Code | Role & Semantics |
| :--- | :--- | :--- |
| **`--color-silver`** | `#E6E9EE` | Light surface bases, metallic linear gradients, card borders, highlighted frame accents. |
| **`--color-violet`** | `#7A0FE0` | Primary brand accent, primary CTA buttons, highlighted 3D "patch path", active glows, key indicators. |
| **`--color-indigo`** | `#4B0F9E` | Secondary brand accent, deep gradient stops, active ring borders, layered backdrops. |
| **`--color-steel-gray`** | `#8A929C` | Neutral secondary text, metadata labels, disabled states, subtle grid rules, captions. |
| **`--color-ink`** | `#1A1220` | Workbench background, terminal panels, dark canvas containers, high-contrast foreground text on silver. |

### Semantic Functional Variations
- **Silver Metallic Gradient**: `linear-gradient(135deg, #FFFFFF 0%, #E6E9EE 50%, #D8DDE6 100%)`
- **Violet Action Gradient**: `linear-gradient(135deg, #7A0FE0 0%, #4B0F9E 100%)`
- **Workbench Ink Panel**: `rgba(26, 18, 32, 0.88)` with `backdrop-filter: blur(20px)` and border `1px solid rgba(138, 146, 156, 0.2)`
- **Patch Path Glow**: `box-shadow: 0 0 24px rgba(122, 15, 224, 0.45)`

---

## 2. Typography

Three typeface pairings deliver technical precision, commanding display hierarchy, and comfortable legibility:

1. **Display & Numbers — Unbounded**:
   - Weights: `700` (Bold), `800` (ExtraBold)
   - Tracking: `-0.04em` (Tight tracking)
   - Applications: Brand logotype, section hero titles, huge stage numerals (`01`–`05`), key metrics.
2. **Body & Controls — DM Sans**:
   - Weights: `400` (Regular), `500` (Medium), `600` (SemiBold)
   - Applications: Nav links, explanations, table contents, rationale descriptions, form labels.
3. **Identifiers, Hashes & Code — JetBrains Mono**:
   - Weights: `400` (Regular), `500` (Medium)
   - Applications: Package PURLs (`pkg:pypi/...`), CVE IDs (`CVE-2026-1001`), SHA-256 digests, CVSS scores, solver runtimes.

---

## 3. Shape Language & Component Architecture

1. **Big Rounded Frames**:
   - Radius tokens: `32px` (`--radius-card`) and `44px` (`--radius-hero`).
   - Cards use outer white/silver hairline borders with soft multi-layered drop shadows (`box-shadow: 0 20px 48px -12px rgba(26, 18, 32, 0.12)`).
2. **Circular Violet Arrow Buttons**:
   - Dimensions: `44px` or `52px` circle with a solid `#7A0FE0` core and outer white/silver ring (`border: 2px solid #FFFFFF`).
   - Inner arrow icon transitions on hover (`transform: translateX(4px)`).
3. **Pill Navigation & Status Chips**:
   - Border radius: `9999px` (`--radius-pill`).
   - Padding: `0.35rem 1rem` for nav pills; `0.2rem 0.65rem` for status chips.
   - States: Active items use `#7A0FE0` background with pure white text; inactive items use ghost silver styling.
4. **Huge Stage Numerals (`01`–`05`)**:
   - Display font: `Unbounded`, size `3.5rem` to `5rem`, gradient fill from `#7A0FE0` to `#8A929C`, low opacity or prominent watermark layout.
5. **Human Approval Authority Guarantee**:
   - Human sign-off badge permanently anchored: *"PatchGraph explains and recommends. Humans approve. Always."*
   - Mandatory reason comment field on approval with ECDSA signature digest recorded into immutable `audit_logs`.

---

## 4. Motion & Three.js 3D Rules

1. **Three.js 3D Hero Scene**:
   - **Layered Spatial Topology**:
     - Layer 0 (Bottom, $Y = -60$): Dependency packages (`example-lib@1.4.0`, `urllib3`).
     - Layer 1 ($Y = -20$): Intermediate applications & SDKs (`checkout-sdk@2.1.0`).
     - Layer 2 ($Y = +20$): Production microservices (`service:checkout`, `service:analytics-worker`).
     - Layer 3 (Top, $Y = +60$): Runtime cluster environments (`prod-cluster-ap-south-1`, `staging-vpc`).
   - **Visual Effects**:
     - Vulnerable nodes emit a pulsating violet outer wireframe corona.
     - Highlighted **Patch Path** connects the root vulnerability to the affected service with laser lines and travelling light pulses.
     - Orbital slow rings rotate around the core cluster while subtle ambient dust particles drift through space.
     - Mouse Parallax smoothly tilts the camera pitch and yaw ($\pm 15^\circ$) with lerp interpolation.
     - Stage Buttons (`01 Ingest`, `02 Graph`, `03 Score`, `04 Optimize`, `05 Approve`) trigger smooth camera trajectory animations.
2. **Performance & Motion Constraints**:
   - **Prefers Reduced Motion**: When `prefers-reduced-motion: reduce` is active, animations stop and a crisp static rendered frame is presented.
   - **Viewport Occlusion Culling**: Rendering loop automatically pauses (`cancelAnimationFrame`) when the hero canvas scrolls out of viewport (`IntersectionObserver`).
   - **Pixel Ratio Clamping**: `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))` prevents mobile GPU overheating.

---

## 5. Accessibility (a11y) & Contrast Guarantee

- **Contrast Ratios**: All text elements on silver metallic surfaces exceed WCAG 2.1 AA requirement of `4.5:1` (using dark ink `#1A1220` or darkened steel `#3D444E`).
- **Focus Indicators**: Every interactive control, button, input, and graph node features high-visibility focus rings (`outline: 2px solid #7A0FE0; outline-offset: 2px`).
- **Screen Reader Support**: All icon-only buttons include explicit `aria-label` attributes.
- **Dual Representation**: The 3D graph view is complemented by an accessible keyboard-navigable Cytoscape 2D view and tabular data grid.
