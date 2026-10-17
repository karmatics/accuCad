class DrawCurveCommand {
  constructor(baseController) {
    this.initBase(baseController);
    this.vertices = [];
    this.vertexDots = [];
    this.curveLine = null;
    this.previewLine = null;
    this.allowSelfSnap = true;

    // Default parameters matching DrawingApp
    this.currentCurvature = 1.0;
    this.currentBalance = 1.0;
  }

  onMouseDown(data) {
    const { point, event } = data;
    if (event && event.button !== 0) return;
    if (!point) return;

    if (this.base.floatingOrigin) {
      this.base.setOrigin(point);
    }

    const vertexClass = (typeof BezierVertex !== 'undefined') ? BezierVertex : globalThis.BezierVertex;
    const v = new vertexClass(point.slice(), 'click');
    v.curvature = this.currentCurvature;
    v.balance = this.currentBalance;
    this.vertices.push(v);

    // Anchor sphere at on-curve through-point
    const sphereGeometry = new THREE.SphereGeometry(0.04, 16, 16);
    const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff66 });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.position.set(point[0], point[1], point[2]);
    this.base.view.scene.add(sphere);
    this.vertexDots.push(sphere);

    this.updatePermanentCurve();

    if (this.previewLine) {
      this.base.view.scene.remove(this.previewLine);
      this.disposeObject(this.previewLine);
      this.previewLine = null;
    }
  }

  onMouseMove(data) {
    const { point } = data;
    if (point && this.vertices.length >= 1) {
      this.updateDynamicPreview(point);
    }
  }

  onRightClick() {
    this.finalizeCurve();
    this.reset();
  }

  updateDynamicPreview(candidatePoint) {
    if (this.previewLine) {
      this.base.view.scene.remove(this.previewLine);
      this.disposeObject(this.previewLine);
      this.previewLine = null;
    }

    if (this.vertices.length === 0) return;

    const vertexClass = (typeof BezierVertex !== 'undefined') ? BezierVertex : globalThis.BezierVertex;
    const solver = (typeof UpdateControlPoints !== 'undefined') ? UpdateControlPoints : globalThis.UpdateControlPoints;

    const liveVertices = this.vertices.map(v => vertexClass.fromJSON ? vertexClass.fromJSON(v.toJSON()) : new vertexClass(v.point.slice()));
    const floatingV = new vertexClass(candidatePoint.slice(), 'move');
    floatingV.curvature = this.currentCurvature;
    floatingV.balance = this.currentBalance;
    liveVertices.push(floatingV);

    solver.run(liveVertices, 4);

    const curvePoints = this._generateSplinePoints(liveVertices, 16);
    if (curvePoints.length < 2) return;

    const flatPositions = curvePoints.flatMap(p => [p.x, p.y, p.z]);
    const geom = new LineGeometry();
    geom.setPositions(flatPositions);

    const mat = new LineMaterial({
      color: 0x38bdf8,
      linewidth: 3,
      transparent: true,
      opacity: 0.85,
      resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
    });

    this.previewLine = new Line2(geom, mat);
    this.base.view.scene.add(this.previewLine);
  }

  updatePermanentCurve() {
    if (this.curveLine) {
      this.base.view.scene.remove(this.curveLine);
      this.disposeObject(this.curveLine);
      this.curveLine = null;
    }

    if (this.vertices.length < 2) return;

    const solver = (typeof UpdateControlPoints !== 'undefined') ? UpdateControlPoints : globalThis.UpdateControlPoints;
    solver.run(this.vertices, 8);

    const curvePoints = this._generateSplinePoints(this.vertices, 24);
    if (curvePoints.length < 2) return;

    const flatPositions = curvePoints.flatMap(p => [p.x, p.y, p.z]);
    const geom = new LineGeometry();
    geom.setPositions(flatPositions);

    const color = this.base.currentColor
      ? (typeof this.base.currentColor === 'string' ? parseInt(this.base.currentColor.replace('#', ''), 16) : this.base.currentColor)
      : 0x00ff66;

    const mat = new LineMaterial({
      color: color,
      linewidth: this.base.lineWidth || 4,
      resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
    });

    this.curveLine = new Line2(geom, mat);
    this.base.view.scene.add(this.curveLine);
  }

  _generateSplinePoints(vertices, segmentsPerSpan = 20) {
    const points = [];
    for (let i = 0; i < vertices.length - 1; i++) {
      const vStart = vertices[i];
      const vEnd = vertices[i + 1];

      const p0 = new THREE.Vector3(vStart.point[0], vStart.point[1], vStart.point[2]);
      const p1 = new THREE.Vector3(vStart.controlPoints[1][0], vStart.controlPoints[1][1], vStart.controlPoints[1][2]);
      const p2 = new THREE.Vector3(vEnd.controlPoints[0][0], vEnd.controlPoints[0][1], vEnd.controlPoints[0][2]);
      const p3 = new THREE.Vector3(vEnd.point[0], vEnd.point[1], vEnd.point[2]);

      const bezier = new THREE.CubicBezierCurve3(p0, p1, p2, p3);
      const spanPts = bezier.getPoints(segmentsPerSpan);
      spanPts.forEach(pt => points.push(pt));
    }
    return points;
  }

  finalizeCurve() {
    if (this.vertices.length < 2) return;

    this.updatePermanentCurve();

    if (this.curveLine) {
      const curveElement = new CurveElement(this.vertices);
      curveElement.id = Math.random().toString(36).substr(2, 9);
      curveElement.color = this.base.currentColor || '#00ff66';
      curveElement.lineWidth = this.base.lineWidth || 4;
      curveElement.threejsObject = this.curveLine;
      curveElement.isTemporary = false;

      this.base.cadElements.push(curveElement);
      this.curveLine = null;
    }
  }
  reset() {
    if (this.previewLine) {
      this.base.view.scene.remove(this.previewLine);
      this.disposeObject(this.previewLine);
      this.previewLine = null;
    }
    if (this.curveLine) {
      this.base.view.scene.remove(this.curveLine);
      this.disposeObject(this.curveLine);
      this.curveLine = null;
    }
    this.vertexDots.forEach(sphere => {
      this.base.view.scene.remove(sphere);
      this.disposeObject(sphere);
    });
    this.vertexDots = [];
    this.vertices = [];
    this.tempElement = null;
  }

  getCommandSettings() {
    return [
      {
        id: 'curvature',
        label: 'Curvature (Fullness)',
        type: 'slider',
        min: 0.1,
        max: 2.5,
        value: this.currentCurvature,
        callback: (val) => {
          this.currentCurvature = val;
          this.vertices.forEach(v => { v.curvature = val; });
          this.updatePermanentCurve();
          this.base.refreshMousePosition();
        }
      },
      {
        id: 'balance',
        label: 'Balance (Weighting)',
        type: 'slider',
        min: 0.1,
        max: 1.9,
        value: this.currentBalance,
        callback: (val) => {
          this.currentBalance = val;
          this.vertices.forEach(v => { v.balance = val; });
          this.updatePermanentCurve();
          this.base.refreshMousePosition();
        }
      }
    ];
  }

  onPoint(data) {
    if (!data) return;
    if (data.mode === 'click') {
      this.onMouseDown(data);
    } else if (data.mode === 'hover') {
      this.onMouseMove(data);
    }
  }

  disposeObject(object) {
    if (!object) return;
    object.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    });
  }

  initBase(baseController) {
    this.base = baseController;
    this.tempElement = null;
    this.previewShape = null;
    this.allowSelfSnap = true;
  }

  dispose() {
    this.reset();
  }
}

globalThis.DrawCurveCommand = DrawCurveCommand;
if (typeof module !== 'undefined' && module.exports) module.exports = DrawCurveCommand;