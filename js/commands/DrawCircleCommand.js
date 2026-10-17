
class DrawCircleCommand {
  
  constructor(baseController) {
    this.initBase(baseController);
    // tempElement will store points: [center, edge]
  }

  onMouseDown(data) {
    const { point, event } = data;
    if (event.button !== 0 || !point) return;

    if (!this.tempElement) {
      this.tempElement = { points: [] };
      this.tempElement.points.push(point.slice());
      if (this.base.floatingOrigin) {
        this.base.setOrigin(point);
      }
    } else {
      this.tempElement.points.push(point.slice());
    }

    if (this.tempElement.points.length === 2) {
      this.finalizeCircle();
      this.reset();
    }
  }

  onMouseMove(data) {
    const { point } = data;
    if (point && this.tempElement && this.tempElement.points.length === 1) {
      this.updatePreviewShape(point);
    }
  }

  onRightClick() {
    this.reset();
  }

  finalizeCircle() {
    if (!this.tempElement || !Array.isArray(this.tempElement.points) || this.tempElement.points.length < 2) return;

    const center = this.tempElement.points[0].slice();
    const edge = this.tempElement.points[1].slice();

    const finalShape = this.createCircleVisual(center, edge, false);
    if (!finalShape) return;

    const radius = Math.hypot(
      edge[0] - center[0],
      edge[1] - center[1],
      (edge[2] || 0) - (center[2] || 0)
    );

    const circleElement = {
      type: 'circle',
      id: Math.random().toString(36).substr(2, 9),
      color: this.base.currentColor || '#00ff00',
      lineWidth: this.base.lineWidth || 4,
      points: [center, edge],
      radius: radius,
      threejsObject: finalShape,
      isTemporary: false,
      toJSON() {
        return {
          id: this.id,
          type: 'circle',
          color: this.color,
          lineWidth: this.lineWidth,
          points: [this.points[0].slice(), this.points[1].slice()],
          radius: this.radius
        };
      }
    };

    this.base.cadElements.push(circleElement);
    this.base.view.scene.add(finalShape);
  }
  updatePreviewShape(previewPoint) {
    if (!this.tempElement || this.tempElement.points.length < 1) return;

    if (this.previewShape) {
      this.base.view.scene.remove(this.previewShape);
      this.disposeObject(this.previewShape);
      this.previewShape = null;
    }

    this.previewShape = this.createCircleVisual(
      this.tempElement.points[0],
      previewPoint,
      true
    );
    if (this.previewShape) {
      this.base.view.scene.add(this.previewShape);
    }
  }

  createCircleVisual(centerArr, edgeArr, isPreview) {
    const center = new THREE.Vector3(...centerArr);
    const edge = new THREE.Vector3(...edgeArr);
    const radius = center.distanceTo(edge);
    if (radius < 1e-6) return null;

    const color = this.base.currentColor
      ? parseInt(this.base.currentColor.replace('#', ''), 16)
      : 0xff0000;

    const viewZ = new THREE.Vector3(...this.base.rotationMatrix[2]);
    const geometry = new THREE.CircleGeometry(radius, 64);

    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      viewZ
    );
    geometry.applyQuaternion(quaternion);
    geometry.translate(center.x, center.y, center.z);

    const material = new THREE.MeshPhongMaterial({
      color: color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: isPreview ? 0.5 : 0.6,
      emissive: color,
      emissiveIntensity: 0.2,
    });
    const circleMesh = new THREE.Mesh(geometry, material);

    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color: color });
    const outline = new THREE.LineSegments(edges, lineMaterial);
    circleMesh.add(outline);

    return circleMesh;
  }

  reset() {
    this.resetBase();
  }

  onPoint(data) {
    if (!data) return;
    if (data.mode === 'click') {
      if (this.onMouseDown) this.onMouseDown(data);
    } else if (data.mode === 'hover') {
      if (this.onMouseMove) this.onMouseMove(data);
    }
  }

  disposeObject(object) {
    if (!object) return;
    object.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach((mat) => mat.dispose());
        else child.material.dispose();
      }
    });
  }

  resetBase() {
    if (this.previewShape) {
      this.base.view.scene.remove(this.previewShape);
      this.disposeObject(this.previewShape);
      this.previewShape = null;
    }
    this.tempElement = null;
  }

  dispose() {
    if (this.reset) this.reset();
  }

  initBase(baseController) {
    this.base = baseController;
    this.tempElement = null;
    this.previewShape = null;
    this.allowSelfSnap = false;
  }

}

