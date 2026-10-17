class CompassDrawBridge {
  /**
   * Headless Coordinate Bridge & Contract Adapter connecting:
   * 1. accuCad (BaseController, AccuDrawLogic, TouchController)
   * 2. CADCraft (PointMod.rs, Accept::POINT, PolyVertex bulges, Mat4::ocs)
   * 3. Bentley iTwin (ThreeAxes, AccuDrawHintBuilder, SmartKeyin)
   */
  constructor(baseController) {
    this.controller = baseController;
    this.pendingHints = [];
    this.activeExtrusionNormal = [0, 0, 1];
    this.mcpSessionId = null;
  }

  // --- 1. Bentley iTwin AccuDrawHintBuilder Implementation ---
  createHintBuilder() {
    const bridge = this;
    const hints = {
      origin: null,
      rotation: null,
      xAxis: null,
      lockDistance: null,
      lockAngle: null,
      mode: null,
      autoOrient: true
    };

    return {
      setOrigin(pt) {
        hints.origin = Array.isArray(pt) ? pt.slice() : [pt.x, pt.y, pt.z || 0];
        return this;
      },
      setRotation(matrix) {
        hints.rotation = matrix.map(r => [...r]);
        return this;
      },
      setXAxis(vec) {
        hints.xAxis = Array.isArray(vec) ? vec.slice() : [vec.x, vec.y, vec.z || 0];
        return this;
      },
      setLockDistance(dist) {
        hints.lockDistance = dist;
        return this;
      },
      setLockAngle(deg) {
        hints.lockAngle = deg;
        return this;
      },
      setMode(mode) {
        hints.mode = mode; // 'rectangular' | 'polar' | 'mixed'
        return this;
      },
      sendHints(activate = true) {
        if (!activate) return false;
        return bridge.applyHints(hints);
      }
    };
  }

  applyHints(hints) {
    const logic = this.controller?.accuDrawLogic;
    if (!logic) return false;

    if (hints.origin) {
      this.controller.setOrigin(hints.origin);
    }

    if (hints.rotation) {
      this.controller.rotationMatrix = hints.rotation;
      if (this.controller.accuDraw) {
        this.controller.accuDraw.setRotationAnimated(hints.rotation, 0.2);
      }
      logic.setRotation(hints.rotation);
    } else if (hints.xAxis) {
      // Derive new ThreeAxes orthonormal basis from hint X-axis
      const currentNormal = this.controller.rotationMatrix ? this.controller.rotationMatrix[2] : [0, 0, 1];
      const zAxis = new THREE.Vector3(...currentNormal).normalize();
      const xAxis = new THREE.Vector3(...hints.xAxis).normalize();
      const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();

      const newMatrix = [
        [xAxis.x, xAxis.y, xAxis.z],
        [yAxis.x, yAxis.y, yAxis.z],
        [zAxis.x, zAxis.y, zAxis.z]
      ];
      this.controller.rotationMatrix = newMatrix;
      if (this.controller.accuDraw) {
        this.controller.accuDraw.setRotationAnimated(newMatrix, 0.2);
      }
      logic.setRotation(newMatrix);
    }

    if (hints.mode) {
      logic.setMode(hints.mode);
    }

    if (typeof hints.lockDistance === 'number') {
      logic.lockedValues.dist = hints.lockDistance;
      logic.isLocked.dist = true;
    }

    if (typeof hints.lockAngle === 'number') {
      logic.lockedValues.angle = hints.lockAngle;
      logic.isLocked.angle = true;
    }

    logic.updateUiLocks();
    this.controller.refreshMousePosition();
    return true;
  }

  // --- 2. CADCraft Mat4::ocs Normal Matrix Calculation ---
  computeOcsMatrix(normal) {
    // Direct parity with CADCraft crates/geom/src/mat.rs: Mat4::ocs
    const nx = normal[0], ny = normal[1], nz = normal[2];
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-9) {
      return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    }
    const unx = nx / len, uny = ny / len, unz = nz / len;

    let axX, axY, axZ;
    if (Math.abs(unx) < 1.0 / 64.0 && Math.abs(uny) < 1.0 / 64.0) {
      // Cross with Y: Y x N
      axX = unz; axY = 0; axZ = -unx;
    } else {
      // Cross with Z: Z x N
      axX = -uny; axY = unx; axZ = 0;
    }
    const axLen = Math.hypot(axX, axY, axZ);
    axX /= axLen; axY /= axLen; axZ /= axLen;

    // AY = N x AX
    const ayX = uny * axZ - unz * axY;
    const ayY = unz * axX - unx * axZ;
    const ayZ = unx * axY - uny * axX;

    return [
      [axX, ayX, unx],
      [axY, ayY, uny],
      [axZ, ayZ, unz]
    ];
  }

  // --- 3. Format Output Point into CADCraft Accept::POINT Payload ---
  formatCadCraftPoint(worldPoint) {
    return {
      type: 'input:point',
      x: worldPoint[0],
      y: worldPoint[1],
      z: worldPoint[2] || 0,
      relativeToOrigin: this.controller.accuDrawLogic ? [
        this.controller.accuDrawLogic.lastLocalDelta.x,
        this.controller.accuDrawLogic.lastLocalDelta.y,
        this.controller.accuDrawLogic.lastLocalDelta.z
      ] : [0, 0, 0],
      activePlaneNormal: this.controller.rotationMatrix ? this.controller.rotationMatrix[2] : [0, 0, 1]
    };
  }

  // --- 4. Serialize Path Element to CADCraft PolyVertex (x, y, bulge) Sequence ---
  toCadCraftPolyline(pathElement) {
    if (!pathElement || !Array.isArray(pathElement.vertices)) return null;

    const polyVertices = pathElement.vertices.map((v) => ({
      point: [v.point[0], v.point[1]],
      elevation: v.point[2] || 0,
      bulge: typeof v.bulge === 'number' ? v.bulge : 0
    }));

    return {
      kind: 'LwPolyline',
      isClosed: !!pathElement.closed,
      vertices: polyVertices,
      normal: this.controller.rotationMatrix ? this.controller.rotationMatrix[2] : [0, 0, 1],
      color: pathElement.color
    };
  }

  // --- 5. Model Context Protocol (MCP) Tool Handler ---
  handleMcpToolCall(method, params) {
    const logic = this.controller?.accuDrawLogic;
    if (!logic) return { error: 'AccuDrawLogic not available' };

    switch (method) {
      case 'compass_set_origin':
        this.controller.setOrigin([params.x || 0, params.y || 0, params.z || 0]);
        return { success: true, origin: this.controller.origin };

      case 'compass_orient_plane':
        if (['top', 'front', 'side', 'view'].includes(params.plane)) {
          this.controller.setDrawingPlane(params.plane);
          return { success: true, plane: params.plane, matrix: this.controller.rotationMatrix };
        } else if (params.normal) {
          const matrix = this.computeOcsMatrix(params.normal);
          this.controller.rotationMatrix = matrix;
          if (this.controller.accuDraw) this.controller.accuDraw.setRotationAnimated(matrix, 0.2);
          logic.setRotation(matrix);
          return { success: true, normal: params.normal, matrix };
        }
        return { error: 'Invalid plane specification' };

      case 'compass_lock_axis':
        if (['x', 'y', 'z', 'dist', 'angle'].includes(params.axis)) {
          logic.lockedValues[params.axis] = params.value;
          logic.isLocked[params.axis] = true;
          logic.updateUiLocks();
          this.controller.refreshMousePosition();
          return { success: true, axis: params.axis, lockedValue: params.value };
        }
        return { error: 'Unknown axis identifier' };

      case 'compass_unlock_all':
        logic.reset();
        this.controller.refreshMousePosition();
        return { success: true, status: 'unlocked' };

      case 'smartline_segment':
        if (params.point) {
          const currentPoint = params.point;
          if (params.bulge && this.controller.activeCommand?.tempElement) {
            const temp = this.controller.activeCommand.tempElement;
            if (temp.vertices && temp.vertices.length > 0) {
              temp.vertices[temp.vertices.length - 1].bulge = params.bulge;
            }
          }
          if (this.controller.activeCommand?.onPoint) {
            this.controller.activeCommand.onPoint({
              mode: 'click',
              point: currentPoint,
              rawPoint: currentPoint
            });
          }
          return { success: true, pointCommitted: currentPoint };
        }
        return { error: 'Point required for smartline segment' };

      default:
        return { error: `Unsupported MCP method: ${method}` };
    }
  }

  listenHostPostMessages() {
    if (this._messageListenerBound) return;
    this._messageListenerBound = true;

    window.addEventListener('message', (event) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      // 1. CADCraft Host Open Request (?host=parent parity)
      if (data.type === 'cadcraft:open' && data.bytes) {
        console.log(`[CompassDrawBridge] Received binary model "${data.name}" (${data.bytes.byteLength} bytes)`);
        if (typeof CadStorageManager !== 'undefined' && this.controller.storageManager) {
          try {
            const text = new TextDecoder().decode(data.bytes);
            const parsed = JSON.parse(text);
            this.controller.storageManager.reconstructDrawing(parsed);
          } catch (err) {
            console.warn('[CompassDrawBridge] Binary parse as JSON drawing note:', err.message);
          }
        }
      }

      // 2. CADCraft Coordinate Input Injection
      if (data.type === 'cadcraft:inject_point' && Array.isArray(data.point)) {
        if (this.controller.activeCommand?.onPoint) {
          this.controller.activeCommand.onPoint({
            mode: 'click',
            point: data.point,
            rawPoint: data.point
          });
        }
      }

      // 3. MCP JSON-RPC Remote Directives
      if (data.type === 'mcp:call' && data.method) {
        const result = this.handleMcpToolCall(data.method, data.params || {});
        if (event.source) {
          event.source.postMessage({
            type: 'mcp:result',
            id: data.id,
            result: result
          }, '*');
        }
      }
    });
  }

  dispatchPointToHost(worldPoint) {
    // If running inside an iframe (e.g. embedded inside CadPlan or CADCraft shell),
    // stream the resolved 3D coordinate up to the parent window
    if (window.parent && window.parent !== window) {
      const payload = this.formatCadCraftPoint(worldPoint);
      window.parent.postMessage(payload, '*');
    }
  }
}

globalThis.CompassDrawBridge = CompassDrawBridge;
if (typeof module !== 'undefined' && module.exports) module.exports = CompassDrawBridge;