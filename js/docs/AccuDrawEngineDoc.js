class AccuDrawEngineDoc {
  static get name() { return 'AccuDrawEngineDoc'; }

  static getMeta() {
    return {
      kicker: "The AccuDraw Constraint System",
      title: "AccuDraw Precision Engine & Visual Feedback",
      subtitle: "Dynamic compass orientation, numeric input stream, CAD smart backspace, and hierarchy of coordinate locks."
    };
  }

  static manifest() {
    return [
      {
        partLabel: "Part I",
        title: "The AccuDraw Philosophy",
        blocks: [
          { id: "philosophyIntro", type: "paragraph" },
          { id: "squircleGeometry", type: "sidebar", title: "Squircle3D Compass Visual", kicker: "Visual Language" },
          { id: "visualFeedback", type: "paragraph" }
        ]
      },
      {
        partLabel: "Part II",
        title: "Coordinate Modes & Locking Hierarchy",
        blocks: [
          { id: "modesExplanation", type: "paragraph" },
          { id: "lockingHierarchy", type: "sidebar", title: "Hierarchy of Constraints", kicker: "Constraint Solver" },
          { id: "smartLockAlgorithm", type: "paragraph" }
        ]
      },
      {
        partLabel: "Part III",
        title: "Keyboard Input & Numerical Typing Stream",
        blocks: [
          { id: "typingStream", type: "paragraph" },
          { id: "smartBackspace", type: "sidebar", title: "The CAD Smart Backspace", kicker: "Interaction Design" },
          { id: "caretAndNavigation", type: "paragraph" }
        ]
      }
    ];
  }

  static philosophyIntro() {
    return [
      "AccuDraw is an intelligent drafting aid that dynamically floats a local Cartesian or polar coordinate compass at the active drafting point. Originally popularized by MicroStation, AccuDraw eliminates the need for separate coordinate entry dialogs, command-line prompts, or tedious construction lines by letting draftspersons lock axes, enter precise lengths, and align geometry with single keystrokes."
    ];
  }

  static squircleGeometry() {
    return [
      "The floating AccuDraw compass is rendered via **`Squircle3D.js`** using an interpolated superellipse (squircle) shape. Rather than a harsh square or plain circle, the curvature smoothly animates depending on drafting context:\n• Rectangular Mode: Softened square outline (squircle = 0.3).\n• Polar Mode: Pure circle (squircle = 1.0).\n• Mixed Mode: Balanced transitional squircle (squircle = 0.5).\nAxis indicator cylinders and colored ticks (Red for X, Green for Y, Gray for negative axes) provide immediate spatial orientation in 3D perspective views."
    ];
  }

  static visualFeedback() {
    return [
      "When the cursor moves along a constrained trajectory, **`AccuDraw.js`** renders a full-screen dashed or solid white index line and animates the corresponding axis ticks with a sinusoidal breathing pulse. If an axis is locked or tentative point captured, a miniature 3-axis jack ('Mini-Jack') renders directly at the projected world coordinate, ensuring the user always knows the exact 3D coordinates where the click will land."
    ];
  }

  static modesExplanation() {
    return [
      "AccuDraw operates in three primary projection modes, toggled instantly using the **`Spacebar`**:\n1. **Rectangular Mode:** Tracks independent orthogonal $X$, $Y$, and $Z$ delta offsets relative to the compass origin.\n2. **Polar Mode:** Tracks radial Distance ($D = \\sqrt{x^2 + y^2}$) and Planar Angle ($\\theta = \\text{atan2}(y, x)$).\n3. **Mixed Mode:** Displays both rectangular deltas and polar distance/angle vectors simultaneously."
    ];
  }

  static lockingHierarchy() {
    return [
      "When evaluating constraints in `EventHandlers.js`, AccuDraw applies a strict three-tier hierarchy:\n1. **Tier 1 (Hard Locks):** Explicit user locks (`X`, `Y`, `Z`, or direct typed numbers). Overrides soft geometric snaps.\n2. **Tier 2 (Tentative Points):** Snaps to existing CAD geometry vertices or edges established by mouse chording.\n3. **Tier 3 (Soft Geometric Snapping):** Proximity alignment to natural 0° or 90° axes from the compass origin."
    ];
  }

  static smartLockAlgorithm() {
    return [
      "Pressing **`L`** triggers the Smart Lock algorithm in `AccuDrawLogic.handleSmartLock()`. It inspects the cursor's current vector relative to the compass origin. If $|x| > |y|$, it snaps and locks $Y = 0$, freeing the cursor to slide strictly along the X-axis. Conversely, if $|y| > |x|$, it locks $X = 0$. If any axis was already locked, pressing `L` immediately clears all planar locks, restoring fluid cursor motion."
    ];
  }

  static typingStream() {
    return [
      "Typing numerical digits (`0-9`, `.`, `-`) instantly intercepts keystrokes without requiring focus in a traditional HTML `<input>` field. AccuDraw's `handleKeyDown` captures the character, opens an active input buffer, marks the current axis locked, and preserves cursor direction so positive inputs naturally travel in the direction the user was moving their mouse."
    ];
  }

  static smartBackspace() {
    return [
      "AccuDraw implements a specialized **CAD Smart Backspace**:\n• If the user is actively typing, `Backspace` deletes the preceding character from the active buffer.\n• If the user has *not* typed, `Backspace` takes the current dynamic coordinate under the mouse, truncates its least significant digit, and initiates an explicit edit session. This allows draftspersons to round or trim live measurements seamlessly."
    ];
  }

  static caretAndNavigation() {
    return [
      "The UI uses a custom neon-green glowing cursor caret (`.accudrawCaret`) rendered via DOM text nodes rather than heavy native input elements. Pressing **`Tab`** switches focus between axes (e.g., $X \\leftrightarrow Y$), committing the value on exit. Pressing **`Escape`** executes a hierarchical rollback: canceling active typing on first press, unlocking the active field on second press, and resetting the drawing tool on third press."
    ];
  }
}

globalThis.AccuDrawEngineDoc = AccuDrawEngineDoc;
if (typeof module !== 'undefined' && module.exports) module.exports = AccuDrawEngineDoc;