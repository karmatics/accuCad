class DrawingToolsDoc {
  static get name() { return 'DrawingToolsDoc'; }

  static getMeta() {
    return {
      kicker: "Geometric Elements & Tools",
      title: "CAD Drawing Primitives & Transformation Pipeline",
      subtitle: "Parametric entity definitions, dynamic previews, and interactive manipulation tools."
    };
  }

  static manifest() {
    return [
      {
        partLabel: "Part I",
        title: "Primitive Elements & Data Structures",
        blocks: [
          { id: "elementsIntro", type: "paragraph" },
          { id: "elementsList", type: "sidebar", title: "Supported Geometric Entities", kicker: "Data Schema" },
          { id: "serialization", type: "paragraph" }
        ]
      },
      {
        partLabel: "Part II",
        title: "Command Lifecycle & Real-Time Dynamic Previews",
        blocks: [
          { id: "commandLifecycle", type: "paragraph" },
          { id: "dynamicPreviewMechanics", type: "paragraph" }
        ]
      },
      {
        partLabel: "Part III",
        title: "Continuous Element Operations & Transformations",
        blocks: [
          { id: "transformationsIntro", type: "paragraph" },
          { id: "rotateScaleArchitecture", type: "sidebar", title: "3-Point Rotate & Scale Matrices", kicker: "Algorithms" },
          { id: "continuousAccepts", type: "paragraph" }
        ]
      }
    ];
  }

  static elementsIntro() {
    return [
      "Every drawn shape in accuCad inherits from **`CadElement`**, ensuring consistent tracking of unique identifiers, color values, line widths, bounding boxes, and pickable vertex coordinates (`points`). Elements represent true mathematical vectors rather than rasterized fragments."
    ];
  }

  static elementsList() {
    return [
      "The engine provides six core geometric primitive types:\n• **RectangleElement:** Parametric box or planar face defined by start point, opposite diagonal point, and orientation matrix.\n• **PathElement:** Multi-vertex polygonal chain supporting fillet corner radii.\n• **ArcElement:** 3-point circular arc defined by start point, center point, and end projection.\n• **CircleElement:** Full circular disc or perimeter defined by center and radius edge.\n• **CurveElement:** 4-point Cubic Bézier curve with draggable control handles.\n• **CapsuleElement:** 3D cylindrical body capped with hemispherical domes."
    ];
  }

  static serialization() {
    return [
      "All elements implement lossless JSON serialization via `toJSON()` and `fromJSON(data)`. This allows drawings to be stored in IndexedDB via `CadStorageManager.js` or exported to standalone `.json` CAD plan files that can be reconstructed with 100% geometric fidelity on any device."
    ];
  }

  static commandLifecycle() {
    return [
      "Interactive drawing commands inherit from **`BaseDrawCommand`** and adhere to a unified state machine:\n1. **First Click (`onMouseDown`):** Anchors the origin and initializes a temporary element flagged `isTemporary = true`.\n2. **Motion (`onMouseMove`):** Regenerates a dynamic preview mesh or line segments added to the Three.js scene graph.\n3. **Subsequent Clicks:** Collect intermediate control points or finalize the geometry.\n4. **Finalize / Reset:** Replaces the transient preview with a permanent Three.js visual, disposes of intermediate memory, and adds the entity to `baseController.cadElements`."
    ];
  }

  static dynamicPreviewMechanics() {
    return [
      "During dynamic mouse dragging, preview visuals are updated at 60 FPS. To prevent rendering artifacts, the permanent sharp lines are temporarily hidden while rounded or smoothed previews are computed. For paths, **`RoundingUtils3D.js`** calculates circular fillets between intersecting segments using 3D vector bisectors and arc generation."
    ];
  }

  static transformationsIntro() {
    return [
      "Manipulation commands—**`MoveElementCommand`**, **`RotateElementCommand`**, and **`ScaleElementCommand`**—support professional CAD workflows. Rather than simply applying Three.js object matrix transformations, accuCad recalculates the underlying vertex and dimension coordinates of the element itself, keeping parametric CAD geometry clean and unskewed."
    ];
  }

  static rotateScaleArchitecture() {
    return [
      "**Rotate and Scale Operations** implement a 3-point reference convention:\n• **Point 1 (Pivot):** The center of rotation or origin of scaling.\n• **Point 2 (Reference Start):** Defines the baseline angle or distance.\n• **Point 3 (Target):** The live cursor destination defining displacement.\nVisual guide lines, dashed angle arcs, and color-coded indicator spheres (Blue for Pivot, Green for Reference, Yellow for Live Target) give the operator real-time feedback."
    ];
  }

  static continuousAccepts() {
    return [
      "Both Move, Rotate, and Scale tools support **Continuous Accepts** and **Make Copy** modes. When *Make Copy* is active, clicking drops a duplicate entity while keeping the transformation session active. In continuous move mode, the element ghosts (turns translucent gray) while the destination click immediately becomes the anchor for subsequent displacements."
    ];
  }
}

globalThis.DrawingToolsDoc = DrawingToolsDoc;
if (typeof module !== 'undefined' && module.exports) module.exports = DrawingToolsDoc;