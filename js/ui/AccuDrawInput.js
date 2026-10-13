class AccuDrawInput {

  constructor(name, color, parentUi) {
    this.name = name;
    this.color = color;
    this.parent = parentUi;
    this.isLocked = false;
    this.caretIndex = 0;
    this.currentValueStr = '0.0000';

    this.outerElem = makeElement('div', {
      className: 'accudrawInputContainer',
      style: {
        backgroundColor: `rgba(${color[0]}, ${color[1]}, ${color[2]}, .4)`,
        borderColor: `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0)`,
        top: '0px',
      },
    });

    this.inputElem = makeElement('div', {
      className: 'accudrawInput',
      style: {
        lineHeight: '32px',
        fontSize: '25px',
        fontFamily: 'rounded, sans-serif',
        textShadow: '2px 2px 2px #000',
        color: '#eee',
        paddingLeft: '8px',
        userSelect: 'none',
        pointerEvents: 'none',
        position: 'absolute',
        left: '0px',
        top: '0px',
        width: '100%',
        height: '100%'
      }
    });

    this.textContainerElem = makeElement('div', {
      style: {
        display: 'inline-block',
        width: '100%',
        height: '100%'
      }
    });
    this.inputElem.appendChild(this.textContainerElem);

    this.lockColorElem = makeElement('div', { className: 'lockColor' });

    // Self-contained inline SVG lock icon to prevent dead host resolution errors
    const lockSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    lockSvg.setAttribute('viewBox', '0 0 24 24');
    lockSvg.setAttribute('width', '22');
    lockSvg.setAttribute('height', '26');
    lockSvg.style.cssText = 'position: absolute; left: 3px; top: 3px; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.8));';
    lockSvg.innerHTML = `
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" fill="#ffd700" stroke="#000" stroke-width="1.5"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4" fill="none" stroke="#ffd700" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="12" cy="16" r="1.5" fill="#000"/>
      <path d="M12 17.5v2" stroke="#000" stroke-width="1.5" stroke-linecap="round"/>
    `;

    this.lockElem = makeElement(
      'div',
      { className: 'lock' },
      this.lockColorElem,
      lockSvg
    );

    this.outerElem.appendChild(this.inputElem);
    this.outerElem.appendChild(this.lockElem);

    this.renderText();
  }
  setValue(val) {
      let displayVal = val;
      if (typeof val === 'number') {
        if (Math.abs(val) < 0.0001) displayVal = '0.0000';
        else displayVal = val.toFixed(4);
      }
      this.currentValueStr = displayVal.toString();

      // ALWAYS run the renderer to guarantee the caret and offsets are synchronized on every browser paint tick
      this.renderText();
    }

  setFocusState(isFocused) {
      const s = this.outerElem.style;
      const c = this.color;

      const baseZ = this.isLocked ? 200000 : isFocused ? 100001 : 100000;

      if (isFocused) {
        s.borderColor = `rgba(${c[0]}, ${c[1]}, ${c[2]}, 0.9)`;
        s.zIndex = baseZ;
        const scale = 1.25;
        s.transform = `scale3d(${scale}, ${scale}, 1)`;
      } else {
        s.borderColor = `rgba(${c[0]}, ${c[1]}, ${c[2]}, 0)`;
        s.zIndex = baseZ;
        s.transform = 'scale3d(1, 1, 1)';
      }
    }

  toggleLock() {
      this.setLocked(!this.isLocked);
    }

  setLocked(locked) {
      if (this.isLocked === locked) return;
      this.isLocked = locked;

      if (locked) {
        this.lockColorElem.style.backgroundColor = `rgba(${this.color[0]}, ${this.color[1]}, ${this.color[2]}, 1)`;

        this.lockElem.style.transition = 'none';
        this.lockElem.style.opacity = '0';
        this.lockElem.style.transform = 'scale3d(0.05, 0.05, 1)';
        this.lockElem.style.display = 'block';

        this.lockElem.offsetHeight;

        requestAnimationFrame(() => {
          this.lockElem.style.transition =
            'transform 0.36s cubic-bezier(0.175, 0.885, 0.32, 1.8), opacity 0.36s ease-in';
          this.lockElem.style.opacity = '1';
          this.lockElem.style.transform = 'scale3d(1, 1, 1)';
        });

        this.outerElem.style.zIndex = 200000;
      } else {
        this.lockElem.style.transition =
          'transform 0.15s ease-in, opacity 0.15s ease-in';
        this.lockElem.style.opacity = '0';
        this.lockElem.style.transform = 'scale3d(0, 0, 1)';

        setTimeout(() => {
          if (!this.isLocked) {
            this.lockElem.style.display = 'none';
          }
        }, 150);

        this.outerElem.style.zIndex = 100000;
      }
    }

  setSmartFocus(isActive) {
      if (this.isLocked) return;

      const s = this.outerElem.style;
      const c = this.color;

      if (isActive) {
        s.borderColor = `rgba(${c[0]}, ${c[1]}, ${c[2]}, 0.6)`;
        s.boxShadow = `0 0 6px rgba(${c[0]}, ${c[1]}, ${c[2]}, 0.4)`;
        s.transform = 'scale3d(1.05, 1.05, 1)';
        s.zIndex = 100005;
      } else {
        s.borderColor = `rgba(${c[0]}, ${c[1]}, ${c[2]}, 0)`;
        s.boxShadow = 'none';
        s.transform = 'scale3d(1, 1, 1)';
        s.zIndex = 100000;
      }
    }

  renderText() {
      this.textContainerElem.innerHTML = '';

      const logic = this.parent.accuDraw?.baseController?.accuDrawLogic;
      const isEditing = logic && logic.inputActive && logic.currentAxis === this.name;

      if (isEditing) {
        const buffer = logic.inputBuffer || '';
        const caretIdx = Math.max(0, Math.min(buffer.length, this.caretIndex));

        const before = buffer.slice(0, caretIdx);
        const after = buffer.slice(caretIdx);

        const beforeNode = document.createTextNode(before);
        // Added zero-width space unicode character to force native line height rendering
        const caretNode = makeElement('span', { className: 'accudrawCaret' }, '\u200b');
        const afterNode = document.createTextNode(after);

        this.textContainerElem.appendChild(beforeNode);
        this.textContainerElem.appendChild(caretNode);
        this.textContainerElem.appendChild(afterNode);
      } else {
        const valText = document.createTextNode(this.currentValueStr || '0.0000');
        this.textContainerElem.appendChild(valText);
      }
    }
}