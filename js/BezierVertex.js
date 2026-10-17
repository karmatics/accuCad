class BezierVertex {
  constructor(point, pointType = 'click') {
    this.point = point.slice();
    // Initialize control points as copies of the vertex through-point.
    this.controlPoints = [point.slice(), point.slice()];
    this.tangents = [null, null];
    this.curvature = 1;
    this.balance = 1;
    this.pointType = pointType;
    this.isTentative = false;
    this.tangentAngleOffset = 0;
  }

  toJSON() {
    return {
      point: this.point,
      controlPoints: this.controlPoints,
      tangents: this.tangents,
      curvature: this.curvature,
      balance: this.balance,
      pointType: this.pointType,
      isTentative: this.isTentative,
      tangentAngleOffset: this.tangentAngleOffset
    };
  }

  static fromJSON(obj) {
    const v = new BezierVertex(obj.point, obj.pointType);
    v.controlPoints = obj.controlPoints;
    v.tangents = obj.tangents;
    v.curvature = obj.curvature;
    v.balance = obj.balance;
    if (typeof obj.isTentative === 'boolean') {
      v.isTentative = obj.isTentative;
    }
    if (typeof obj.tangentAngleOffset === 'number') {
      v.tangentAngleOffset = obj.tangentAngleOffset;
    }
    return v;
  }
}

globalThis.BezierVertex = BezierVertex;
if (typeof module !== 'undefined' && module.exports) module.exports = BezierVertex;