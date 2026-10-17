class AccuCadArchitectureDoc {
  static get name() { return 'AccuCadArchitectureDoc'; }

  static getMeta() {
    return {
      kicker: "Engine Architecture & Pipeline",
      title: "accuCad 3D Core Architecture & Coordinate Pipeline",
      subtitle: "The mathematical foundations, raycasting unprojection, drawing plane matrices, and input state dispatching."
    };
  }

  static manifest() {
    return [
      {
        partLabel: "Part I",
        title: "System Overview & Scene Graph Topology",
        blocks: [
          { id: "systemOverview", type: "paragraph" },
          { id: "componentStack", type: "sidebar", title: "Core Component Topology", kicker: "Architecture" },
          { id: "lifecycleDisposal", type: "paragraph" }
        ]
      },
      {
        partLabel: "Part II",
        title: "Coordinate Space Transformations & Raycasting",
        blocks: [
          { id: "screenToWorldProjection", type: "paragraph" },
          { id: "planeMath", type: "sidebar", title: "Drawing Plane Matrix Basis", kicker: "Mathematics" },
          { id: "generatePointLogic", type: "paragraph" }
        ]
      },
      {
        partLabel: "Part III",
        title: "Event Dispatching & Two-Button Mouse Chording",
        blocks: [
          { id: "eventDispatcher", type: "paragraph" },
          { id: "mouseChordingQuote", type: "quote" },
          { id: "chordingImplementation", type: "paragraph" }
        ]
      }
    ];
  }

  static systemOverview() {
    return [
      "**accuCad** is a high-performance browser-native 2D and 3D computer-aided design (CAD) engine written in pure ES6 on top of Three.js. Unlike traditional mesh modelers that prioritize polygon counts and artistic sculpts, accuCad is engineered for **geometric determinism**, sub-millimeter precision, and procedural parametric authoring directly within WebGL canvas viewports."
    ];
  }

  static componentStack() {
    return [
      "The engine is structured around five primary subsystem pillars:\n• **ThreeJSLoader:** Boots the WebGLRenderer with ACES Filmic tone mapping, studio lighting, camera management, and window resizing.\n• **BaseController:** Owns the active CAD elements collection, current drawing plane, tool registration, color, and stroke settings.\n• **GeneratePoint:** Performs ray-plane intersection from 2D screen mouse coordinates to arbitrary 3D drawing planes.\n• **AccuDraw & AccuDrawLogic:** Real-time geometric constraint, axis projection, and numerical coordinate lock engine.\n• **Command Hierarchy:** Modular tool commands implementing the standardized onPoint lifecycle."
    ];
  }

  static lifecycleDisposal() {
    return [
      "Memory management in long-running WebGL CAD sessions is critical. accuCad strictly implements a recursive disposal pattern through **`ElementOperations.disposeObject(obj)`**. Whenever elements are deleted, transformed, or temporary preview shapes are discarded, buffer geometries, materials, line textures, and edge meshes are explicitly disposed of, avoiding WebGL context leaks and garbage collection stutters during complex assemblies."
    ];
  }

  static screenToWorldProjection() {
    return [
      "Translating a 2D viewport mouse pointer $(x, y)$ into a meaningful 3D point in space requires projectively casting a ray from the camera lens and finding its intersection with an active CAD plane. Because the camera can orbit at any arbitrary tilt, spin, and perspective FOV, the ray origin is derived from the camera's world position, and its normalized direction vector is calculated using inverse projection matrices."
    ];
  }

  static planeMath() {
    return [
      "A drawing plane in accuCad is defined as an orthonormal $3 \\times 3$ rotation matrix basis $[\\vec{X}, \\vec{Y}, \\vec{Z}]$. The standard reference planes are:\n• **Top Plane:** $\\vec{X}=[1, 0, 0], \\vec{Y}=[0, 0, -1], \\vec{Z}=[0, 1, 0]$\n• **Front Plane:** $\\vec{X}=[1, 0, 0], \\vec{Y}=[0, 1, 0], \\vec{Z}=[0, 0, 1]$\n• **Side Plane:** $\\vec{X}=[0, 0, 1], \\vec{Y}=[0, 1, 0], \\vec{Z}=[-1, 0, 0]$\nWhen drawing, points are constrained so that $(\\vec{P} - \\vec{Origin}) \\cdot \\vec{Z} = 0$, enforcing exact coplanarity unless Z-lock is explicitly bypassed."
    ];
  }

  static generatePointLogic() {
    return [
      "The **`GeneratePoint.generate()`** static utility calculates the ray-plane intersection in world space and immediately calculates local planar offsets $x_{local} = \\vec{V} \\cdot \\vec{X}$ and $y_{local} = \\vec{V} \\cdot \\vec{Y}$. If soft indexing is active and the cursor passes within `indexTolerance` of either coordinate axis, the output point snaps precisely onto that axis line, returning an `indexedToAxis` identifier ('x', 'y', or 'xy' for origin snap)."
    ];
  }

  static eventDispatcher() {
    return [
      "Input events are unified under **`EventHandlers.js`**. Mouse motion and clicks are never fed directly to tool commands in raw screen pixels. Instead, they are routed through the AccuDraw constraint solver first, producing a unified point package containing `mode` ('click' or 'hover'), `rawPoint` (pure unprojected raycast), and `point` (the final constrained and locked 3D coordinate)."
    ];
  }

  static mouseChordingQuote() {
    return [
      "By combining Left (Data) and Right (Reset) clicks within a 50-millisecond chord window, the draftsman triggers tentative point snaps to existing element vertices without needing to switch active tools."
    ];
  }

  static chordingImplementation() {
    return [
      "The mouse chording algorithm records the millisecond timestamp of button presses. If the user presses both buttons nearly simultaneously ($\\Delta t < 50\\text{ms}$), single-click timers are cleared, and **`TentativePointHandler.handleTentativePoint()`** executes. This snaps an animated pulsing 3D crosshair onto the nearest vertex or edge of any existing CAD entity, setting an anchor point for relative AccuDraw coordinate indexing."
    ];
  }
}

globalThis.AccuCadArchitectureDoc = AccuCadArchitectureDoc;
if (typeof module !== 'undefined' && module.exports) module.exports = AccuCadArchitectureDoc;