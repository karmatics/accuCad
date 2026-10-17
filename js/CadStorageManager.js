class CadStorageManager {
    constructor(baseController) {
      this.baseController = baseController;
      this.dbName = 'accuCad_Storage';
      this.storeName = 'drawings';
      this.db = null;
      this.currentProjectName = '';
      this.uiContainer = null;
    }

    async init() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName, 1);
        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName, { keyPath: 'name' });
          }
        };
        request.onsuccess = (e) => {
          this.db = e.target.result;
          resolve(this.db);
        };
        request.onerror = (e) => {
          reject(e.target.error);
        };
      });
    }

    async saveDrawing(name) {
      if (!this.db) await this.init();

      const elementsData = this.baseController.cadElements
        .filter(el => !el.isTemporary)
        .map(el => {
          if (typeof el.toJSON === 'function') {
            return el.toJSON();
          }
          return {
            type: el.type,
            id: el.id || Math.random().toString(36).substr(2, 9),
            color: el.color,
            points: el.points ? el.points.map(p => [...p]) : []
          };
        });

      const drawing = {
        name: name,
        timestamp: Date.now(),
        plane: this.baseController.planeType || 'top',
        elements: elementsData
      };

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.put(drawing);
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
      });
    }

    async loadDrawing(name) {
      if (!this.db) await this.init();

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.get(name);
        request.onsuccess = (e) => {
          const drawing = e.target.result;
          if (drawing) {
            this.reconstructDrawing(drawing);
            resolve(drawing);
          } else {
            reject(new Error(`Drawing "${name}" not found.`));
          }
        };
        request.onerror = (e) => reject(e.target.error);
      });
    }

    async deleteDrawing(name) {
      if (!this.db) await this.init();
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.delete(name);
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
      });
    }

    async listDrawings() {
      if (!this.db) await this.init();
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.getAll();
        request.onsuccess = (e) => {
          const drawings = e.target.result || [];
          drawings.sort((a, b) => b.timestamp - a.timestamp);
          resolve(drawings);
        };
        request.onerror = (e) => reject(e.target.error);
      });
    }

    reconstructDrawing(drawing) {
      const bc = this.baseController;

      while (bc.cadElements.length > 0) {
        const el = bc.cadElements[0];
        if (el.threejsObject) {
          bc.view.scene.remove(el.threejsObject);
          el.threejsObject.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
              else child.material.dispose();
            }
          });
        }
        bc.cadElements.shift();
      }

      if (drawing.plane) {
        bc.setDrawingPlane(drawing.plane);
      }

      const elements = drawing.elements.map((item) => {
        let el = null;
        if (item.type === 'path') {
          el = PathElement.fromJSON(item);
        } else if (item.type === 'capsule') {
          el = CapsuleElement.fromJSON(item);
        } else if (item.type === 'rectangle') {
          el = RectangleElement.fromJSON(item);
        } else if (item.type === 'arc') {
          el = ArcElement.fromJSON(item);
        } else if (item.type === 'curve') {
          el = CurveElement.fromJSON(item);
        } else if (item.type === 'circle') {
          el = {
            type: 'circle',
            id: item.id || Math.random().toString(36).substr(2, 9),
            color: item.color,
            points: item.points.map(p => [...p]),
            isTemporary: false
          };
        }
        return el;
      }).filter(el => el !== null);

      elements.forEach((el) => {
        bc.cadElements.push(el);

        if (el.type === 'path') {
          const cmd = new DrawPathCommand(bc);
          cmd.tempElement = el;
          cmd.updatePermanentGeometry();
        } else if (el.type === 'capsule') {
          const cmd = new DrawCapsuleCommand(bc);
          cmd.tempElement = el;
          cmd.finalizeCapsule();
        } else if (el.type === 'rectangle') {
          const cmd = new DrawRectangleCommand(bc);
          cmd.tempElement = el;
          cmd.finalizeRectangle();
        } else if (el.type === 'arc') {
          this.buildArcVisual(el);
        } else if (el.type === 'curve') {
          this.buildCurveVisual(el);
        } else if (el.type === 'circle') {
          this.buildCircleVisual(el);
        }
      });
    }

    buildArcVisual(el) {
      const bc = this.baseController;
      const cmd = new DrawArcCommand(bc);
      const arcData = cmd.computeArcData(el.startPt, el.center, el.endPt);
      if (!arcData) return;

      const arcCurve = new THREE.ArcCurve(
        0,
        0,
        arcData.radius,
        arcData.startAngle,
        arcData.endAngle,
        arcData.clockwise
      );
      const points2D = arcCurve.getPoints(50);
      const points3D = points2D.map((pt) => {
        const vec = new THREE.Vector3().addVectors(
          arcData.u.clone().multiplyScalar(pt.x),
          arcData.v.clone().multiplyScalar(pt.y)
        );
        vec.add(new THREE.Vector3(...el.center));
        return vec;
      });

      const positions = points3D.flatMap((v) => [v.x, v.y, v.z]);
      const geometry = new LineGeometry();
      geometry.setPositions(positions);
      const material = new LineMaterial({
        color: el.color ? (typeof el.color === 'string' ? parseInt(el.color.replace('#', ''), 16) : el.color) : 0xff0000,
        linewidth: el.lineWidth || bc.lineWidth || 4,
        resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
      });
      const line = new Line2(geometry, material);
      el.threejsObject = line;
      bc.view.scene.add(line);
    }

    buildCurveVisual(el) {
      ElementOperations.buildVisualCurve(this.baseController, el);
    }
    buildCircleVisual(el) {
      const bc = this.baseController;
      const cmd = new DrawCircleCommand(bc);
      const center = el.points[0];
      const edge = el.points[1] || [center[0] + 1, center[1], center[2]];
      const line = cmd.createCircleVisual(center, edge, false);
      if (line) {
        el.threejsObject = line;
        bc.view.scene.add(line);
      }
    }

    renderUI() {
      const sidePanel = this.baseController.sidePanel;
      if (!sidePanel) return;

      const section = sidePanel.addSection('drawings', 'Saved Projects', false);
      this.uiContainer = section;
      this.updateUI();
    }

    async updateUI() {
      if (!this.uiContainer) return;
      this.uiContainer.innerHTML = '';

      let drawings = [];
      try {
        drawings = await this.listDrawings();
      } catch (err) {
        console.error('Failed to list drawings', err);
      }

      const container = makeElement('div', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          padding: '4px 0'
        }
      });

      const nameRow = makeElement('div', {
        style: { display: 'flex', gap: '6px' }
      });
      const nameInput = makeElement('input', {
        type: 'text',
        placeholder: 'Project Name',
        value: this.currentProjectName || '',
        style: {
          flexGrow: 1,
          background: '#111',
          border: '1px solid #444',
          color: '#fff',
          padding: '4px 6px',
          borderRadius: '4px',
          fontSize: '12px'
        }
      });
      nameInput.oninput = (e) => {
        this.currentProjectName = e.target.value;
      };

      const saveBtn = makeElement('button', {
        style: {
          background: '#0088ff',
          border: 'none',
          color: '#fff',
          padding: '4px 8px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '11px',
          fontWeight: 'bold'
        },
        onclick: async () => {
          const name = nameInput.value.trim();
          if (!name) {
            alert('Please enter a project name.');
            return;
          }
          await this.saveDrawing(name);
          this.currentProjectName = name;
          this.updateUI();
        }
      }, 'Save');

      nameRow.appendChild(nameInput);
      nameRow.appendChild(saveBtn);
      container.appendChild(nameRow);

      // Export Active Scene to standard DXF button
      const dxfBtn = makeElement('button', {
        style: {
          background: '#161e2b',
          border: '1px solid #10b981',
          color: '#10b981',
          padding: '5px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '11px',
          fontWeight: 'bold',
          marginTop: '2px',
          fontFamily: 'monospace'
        },
        onclick: () => {
          this.exportToDxf(null, `${this.currentProjectName || 'drawing'}.dxf`);
        }
      }, '📤 Export Scene to DXF');
      container.appendChild(dxfBtn);

      if (drawings.length > 0) {
        const listContainer = makeElement('div', {
          style: {
            maxHeight: '150px',
            overflowY: 'auto',
            border: '1px solid #333',
            borderRadius: '4px',
            background: '#151515',
            marginTop: '4px'
          }
        });

        drawings.forEach((drawing) => {
          const isCurrent = this.currentProjectName === drawing.name;
          const row = makeElement('div', {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '6px 8px',
              borderBottom: '1px solid #222',
              fontSize: '12px',
              cursor: 'pointer',
              color: isCurrent ? '#00ff66' : '#ddd',
              background: isCurrent ? '#1a2a1a' : 'transparent'
            }
          });

          const label = makeElement('span', {
            style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexGrow: 1 },
            onclick: async () => {
              if (confirm(`Open "${drawing.name}"? This will clear current elements.`)) {
                await this.loadDrawing(drawing.name);
                this.currentProjectName = drawing.name;
                this.updateUI();
              }
            }
          }, drawing.name);

          const actions = makeElement('div', {
            style: { display: 'flex', gap: '4px' }
          });

          const dxfRowBtn = makeElement('button', {
            style: {
              background: '#1e293b',
              border: '1px solid #10b981',
              color: '#10b981',
              padding: '2px 5px',
              borderRadius: '2px',
              cursor: 'pointer',
              fontSize: '10px'
            },
            title: 'Export to AutoCAD DXF with bulges',
            onclick: (e) => {
              e.stopPropagation();
              this.exportToDxf(drawing);
            }
          }, 'DXF');

          const expBtn = makeElement('button', {
            style: {
              background: '#444',
              border: 'none',
              color: '#fff',
              padding: '2px 6px',
              borderRadius: '2px',
              cursor: 'pointer',
              fontSize: '10px'
            },
            title: 'Export to JSON',
            onclick: (e) => {
              e.stopPropagation();
              this.exportDrawing(drawing);
            }
          }, 'JSON');

          const delBtn = makeElement('button', {
            style: {
              background: '#aa2222',
              border: 'none',
              color: '#fff',
              padding: '2px 6px',
              borderRadius: '2px',
              cursor: 'pointer',
              fontSize: '10px'
            },
            onclick: async (e) => {
              e.stopPropagation();
              if (confirm(`Delete project "${drawing.name}"?`)) {
                await this.deleteDrawing(drawing.name);
                if (this.currentProjectName === drawing.name) {
                  this.currentProjectName = '';
                }
                this.updateUI();
              }
            }
          }, 'Del');

          actions.appendChild(dxfRowBtn);
          actions.appendChild(expBtn);
          actions.appendChild(delBtn);
          row.appendChild(label);
          row.appendChild(actions);
          listContainer.appendChild(row);
        });

        container.appendChild(listContainer);
      } else {
        const noProjects = makeElement('div', {
          style: { fontSize: '11px', color: '#666', textAlign: 'center', padding: '10px 0' }
        }, 'No saved projects.');
        container.appendChild(noProjects);
      }

      const importRow = makeElement('div', {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '6px',
          borderTop: '1px solid #333',
          paddingTop: '8px'
        }
      });

      const importLabel = makeElement('span', {
        style: { fontSize: '11px', color: '#aaa' }
      }, 'Import Project:');

      const fileInput = makeElement('input', {
        type: 'file',
        accept: '.json',
        style: { display: 'none' }
      });
      fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
          try {
            const data = JSON.parse(evt.target.result);
            if (!data.name || !Array.isArray(data.elements)) {
              alert('Invalid file format. Must be a project JSON.');
              return;
            }
            await this.saveImportedDrawing(data);
            this.updateUI();
          } catch (err) {
            alert('Failed to parse file: ' + err.message);
          }
        };
        reader.readAsText(file);
      };

      const importBtn = makeElement('button', {
        style: {
          background: '#333',
          border: '1px solid #555',
          color: '#ccc',
          padding: '3px 8px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '11px'
        },
        onclick: () => fileInput.click()
      }, 'Browse...');

      importRow.appendChild(importLabel);
      importRow.appendChild(importBtn);
      importRow.appendChild(fileInput);
      container.appendChild(importRow);

      this.uiContainer.appendChild(container);
    }
    exportDrawing(drawing) {
      const json = JSON.stringify(drawing, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = makeElement('a', {
        href: url,
        download: `${drawing.name}.json`
      });
      a.click();
      URL.revokeObjectURL(url);
    }

    async saveImportedDrawing(drawing) {
      if (!this.db) await this.init();
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.put(drawing);
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
      });
    }

  exportToDxf(drawingOrElements = null, filename = null) {
    let elements = [];
    if (Array.isArray(drawingOrElements)) {
      elements = drawingOrElements;
    } else if (drawingOrElements && Array.isArray(drawingOrElements.elements)) {
      elements = drawingOrElements.elements;
    } else if (this.baseController && Array.isArray(this.baseController.cadElements)) {
      elements = this.baseController.cadElements.filter(el => !el.isTemporary);
    }

    const outName = filename || (drawingOrElements && drawingOrElements.name ? `${drawingOrElements.name}.dxf` : `accuCad_export_${Date.now()}.dxf`);

    let dxf = "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n0\nENDSEC\n";
    dxf += "0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n1\n";
    dxf += "0\nLAYER\n2\n0\n70\n0\n62\n7\n6\nCONTINUOUS\n0\nENDTAB\n0\nENDSEC\n";
    dxf += "0\nSECTION\n2\nENTITIES\n";

    elements.forEach((el) => {
      if (el.type === 'path' && Array.isArray(el.vertices) && el.vertices.length >= 2) {
        dxf += "0\nLWPOLYLINE\n8\n0\n";
        dxf += `90\n${el.vertices.length}\n`;
        dxf += `70\n${el.closed ? 1 : 0}\n`;

        el.vertices.forEach((v) => {
          dxf += `10\n${v.point[0].toFixed(4)}\n`;
          dxf += `20\n${v.point[1].toFixed(4)}\n`;
          if (typeof v.bulge === 'number' && Math.abs(v.bulge) > 1e-6) {
            dxf += `42\n${v.bulge.toFixed(6)}\n`;
          }
        });
      } else if (el.type === 'circle' && Array.isArray(el.points) && el.points.length >= 2) {
        const center = el.points[0];
        const edge = el.points[1];
        const r = Math.hypot(edge[0] - center[0], edge[1] - center[1], (edge[2] || 0) - (center[2] || 0));
        dxf += "0\nCIRCLE\n8\n0\n";
        dxf += `10\n${center[0].toFixed(4)}\n20\n${center[1].toFixed(4)}\n30\n${(center[2] || 0).toFixed(4)}\n`;
        dxf += `40\n${r.toFixed(4)}\n`;
      } else if (el.type === 'arc' && el.startPt && el.center && el.endPt) {
        const center = el.center;
        const r = Math.hypot(el.startPt[0] - center[0], el.startPt[1] - center[1]);
        let a1 = Math.atan2(el.startPt[1] - center[1], el.startPt[0] - center[0]) * (180 / Math.PI);
        let a2 = Math.atan2(el.endPt[1] - center[1], el.endPt[0] - center[0]) * (180 / Math.PI);
        if (a1 < 0) a1 += 360;
        if (a2 < 0) a2 += 360;

        dxf += "0\nARC\n8\n0\n";
        dxf += `10\n${center[0].toFixed(4)}\n20\n${center[1].toFixed(4)}\n30\n${(center[2] || 0).toFixed(4)}\n`;
        dxf += `40\n${r.toFixed(4)}\n`;
        dxf += `50\n${a1.toFixed(4)}\n51\n${a2.toFixed(4)}\n`;
      } else if (el.type === 'curve') {
        const solver = (typeof UpdateControlPoints !== 'undefined') ? UpdateControlPoints : globalThis.UpdateControlPoints;
        const vertexClass = (typeof BezierVertex !== 'undefined') ? BezierVertex : globalThis.BezierVertex;

        let verts = el.vertices;
        if (!verts || verts.length < 2) {
          if (el.points && el.points.length >= 2) {
            verts = el.points.map(p => new vertexClass([...p]));
          }
        }

        if (verts && verts.length >= 2) {
          solver.run(verts, 8);
          const steps = 16;
          for (let i = 0; i < verts.length - 1; i++) {
            const v0 = verts[i].point;
            const cp1 = verts[i].controlPoints[1];
            const cp2 = verts[i + 1].controlPoints[0];
            const v1 = verts[i + 1].point;

            let px = v0[0], py = v0[1], pz = v0[2] || 0;

            for (let s = 1; s <= steps; s++) {
              const t = s / steps;
              const mt = 1 - t;
              const cx = mt*mt*mt*v0[0] + 3*mt*mt*t*cp1[0] + 3*mt*t*t*cp2[0] + t*t*t*v1[0];
              const cy = mt*mt*mt*v0[1] + 3*mt*mt*t*cp1[1] + 3*mt*t*t*cp2[1] + t*t*t*v1[1];
              const cz = mt*mt*mt*(v0[2]||0) + 3*mt*mt*t*(cp1[2]||0) + 3*mt*t*t*(cp2[2]||0) + t*t*t*(v1[2]||0);

              dxf += "0\nLINE\n8\nCOMPASSDRAW_CURVES\n";
              dxf += `10\n${px.toFixed(4)}\n20\n${py.toFixed(4)}\n30\n${pz.toFixed(4)}\n`;
              dxf += `11\n${cx.toFixed(4)}\n21\n${cy.toFixed(4)}\n31\n${cz.toFixed(4)}\n`;

              px = cx; py = cy; pz = cz;
            }
          }
        }
      } else if (el.type === 'rectangle' && el.start && el.end) {
        const x0 = el.start[0], y0 = el.start[1];
        const x1 = el.end[0], y1 = el.end[1];
        dxf += "0\nLWPOLYLINE\n8\n0\n90\n4\n70\n1\n";
        dxf += `10\n${x0.toFixed(4)}\n20\n${y0.toFixed(4)}\n`;
        dxf += `10\n${x1.toFixed(4)}\n20\n${y0.toFixed(4)}\n`;
        dxf += `10\n${x1.toFixed(4)}\n20\n${y1.toFixed(4)}\n`;
        dxf += `10\n${x0.toFixed(4)}\n20\n${y1.toFixed(4)}\n`;
      }
    });

    dxf += "0\nENDSEC\n0\nEOF\n";

    const blob = new Blob([dxf], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = outName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
if (typeof window !== 'undefined') window.CadStorageManager = CadStorageManager;
globalThis.CadStorageManager = CadStorageManager;
