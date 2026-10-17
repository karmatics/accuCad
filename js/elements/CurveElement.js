class CurveElement {

  constructor(verticesOrPoints = []) {
    this.initCadElement();
    this.type = 'curve';
    this.vertices = [];
    this.points = [];

    const vertexClass = (typeof BezierVertex !== 'undefined') ? BezierVertex : globalThis.BezierVertex;

    if (Array.isArray(verticesOrPoints)) {
      verticesOrPoints.forEach((item) => {
        if (item instanceof vertexClass) {
          this.vertices.push(item);
          this.points.push([...item.point]);
        } else if (item && item.point) {
          const v = vertexClass.fromJSON ? vertexClass.fromJSON(item) : new vertexClass([...item.point]);
          this.vertices.push(v);
          this.points.push([...v.point]);
        } else if (Array.isArray(item) && item.length >= 2) {
          const v = new vertexClass([...item]);
          this.vertices.push(v);
          this.points.push([...item]);
        }
      });
    }

    this.controlPoints = this.points;
    this.updateDimensions();
  }

  updateDimensions() {
    if (!this.points || this.points.length === 0) return;

    const xs = this.points.map((pt) => pt[0]);
    const ys = this.points.map((pt) => pt[1]);
    const zs = this.points.map((pt) => pt[2] || 0);

    this.min = [Math.min(...xs), Math.min(...ys), Math.min(...zs)];
    this.max = [Math.max(...xs), Math.max(...ys), Math.max(...zs)];
    this.center = [
      (this.min[0] + this.max[0]) / 2,
      (this.min[1] + this.max[1]) / 2,
      (this.min[2] + this.max[2]) / 2,
    ];
    this.size = [
      this.max[0] - this.min[0],
      this.max[1] - this.min[1],
      this.max[2] - this.min[2],
    ];
  }

  toJSON() {
    const base = this.toJSONBase();
    return {
      ...base,
      type: 'curve',
      vertices: Array.isArray(this.vertices) ? this.vertices.map((v) => (v.toJSON ? v.toJSON() : { point: [...v.point] })) : [],
      points: Array.isArray(this.points) ? this.points.map((pt) => [...pt]) : [],
      controlPoints: Array.isArray(this.points) ? this.points.map((pt) => [...pt]) : [],
      lineWidth: this.lineWidth || 4,
      color: this.color
    };
  }

  static fromJSON(data) {
    const items = data.vertices || data.points || data.controlPoints || [];
    const element = new CurveElement(items);
    element.id = data.id || Math.random().toString(36).substr(2, 9);
    element.type = data.type || 'curve';
    element.color = data.color !== undefined ? data.color : 0x00ff66;
    element.lineWidth = data.lineWidth || 4;
    element.isTemporary = !!data.isTemporary;
    element.updateDimensions();
    return element;
  }
  initCadElement() {
    this.id = Math.random().toString(36).substr(2, 9);
    this.color = 0x000000;
    this.opacity = 1.0;
    this.lineWidth = 1;
    this.isSelected = false;
    this.isTemporary = false;
    this.points = [];
  }

  toJSONBase() {
    return { id: this.id, type: this.type, color: this.color, isTemporary: this.isTemporary };
  }

}

