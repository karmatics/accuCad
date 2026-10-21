class Main {
  constructor() {
    this.app = null;
    this.baseController = null;
    this.threeDView = null;
  }

  _exposeGlobals(threeDView, baseController) {
    if (DebugConfig.exposeThreeDView) globalThis.threeDView = threeDView;
    if (DebugConfig.exposeBaseController)
      globalThis.baseController = baseController;
  }

  async run(env, options = {}) {
    console.log('[accuCad] run() invoked.');
    if (this.rootElement) this.destroy();

    if (!env || !env.container) {
      throw new Error(
        '[accuCad] run() requires an environment object with a valid container.'
      );
    }

    const opts = Object.assign({
      showSidePanel: true,
      showCompass: true,
      showCompassUi: false, // Default to clean in-canvas 3D compass with no floating DOM dialog clutter
      cameraPos: { x: 5, y: 5, z: 8 },
      target: [0, 0.4, 0],
      background: 0x090d16,
      enableControls: true,
      presetGeometry: null,
      initialTool: 'rectangle',
      initialPlane: 'top',
      squircle: 0.35,
      compassSize: 0.85
    }, env, options);

    const parentElement = env.container;
    this.rootElement = parentElement;

    const resetScroll = () => {
      if (this.rootElement) {
        this.rootElement.scrollLeft = 0;
        this.rootElement.scrollTop = 0;
      }
    };

    this.rootElement.addEventListener('scroll', resetScroll);
    this._scrollResetHandler = resetScroll;

    const layoutWrapper = document.createElement('div');
    layoutWrapper.id = 'accucad-layout-wrapper';
    layoutWrapper.style.cssText =
      'display: flex; flex-direction: row; width: 100%; height: 100%; overflow: hidden; position: relative;';
    parentElement.appendChild(layoutWrapper);
    this.layoutWrapper = layoutWrapper;

    const canvasId = 'accucad-canvas-' + Math.random().toString(36).slice(2);
    const canvasContainer = document.createElement('div');
    canvasContainer.id = canvasId;
    canvasContainer.style.cssText =
      'flex-grow: 1; width: 100%; height: 100%; position: relative; overflow: hidden;';
    layoutWrapper.appendChild(canvasContainer);
    this.canvasContainer = canvasContainer;

    if (
      !parentElement._vibesAppResizeObserver &&
      typeof ResizeObserver !== 'undefined'
    ) {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (this.app && typeof this.app.resize === 'function') {
            this.app.resize(entry.contentRect.width, entry.contentRect.height);
          }
        }
      });
      ro.observe(canvasContainer);
      parentElement._vibesAppResizeObserver = ro;
    }

    const staticClasses = [
      'CameraOrbitAnimator',
      'DebugConfig',
      'ElementOperations',
      'ModelLoader',
      'TentativePointHandler',
      'ViewControlsManager',
      'ViewManipulator',
    ];
    for (const clsName of staticClasses) {
      const cls = window[clsName] || globalThis[clsName];
      if (cls && typeof cls.initStatics === 'function') cls.initStatics();
    }

    if (typeof PopupBox !== 'undefined' && typeof PopupBox.init === 'function') {
      PopupBox.init();
    }

    this.app = new ThreeJSLoader(canvasId, {
      cameraPos: opts.cameraPos,
      enableControls: opts.enableControls,
      useThickLines: true,
      commonLoaders: true,
      environment: false,
      lighting: true,
      onUpdate: () => this._onUpdate?.(),
    });

    await this.app.init(canvasContainer);

    this.THREE = this.app.THREE || window.THREE;
    if (this.app.scene) {
      this.app.scene.background = new this.THREE.Color(opts.background);
    }

    const target = new this.THREE.Vector3(...opts.target);
    this.app.camera.lookAt(target);

    this.threeDView = {
      scene: opts.sharedScene || this.app.scene,
      camera: this.app.camera,
      renderer: this.app.renderer,
      target: target,
      envRotation: 0,
    };

    if (opts.sharedController) {
      this.baseController = opts.sharedController;
    } else {
      this.baseController = new BaseController(
        this.threeDView,
        this.app.renderer.domElement
      );
      // Explicitly pass showCompassUi to prevent spawning orphan floating dialogs
      ControllerSetup.initializeController(
        this.baseController,
        this.threeDView.scene,
        { showUi: opts.showCompassUi === true }
      );
    }

    // Only mount SidePanel if explicitly requested
    if (opts.showSidePanel && typeof SidePanel !== 'undefined') {
      const sidePanelEnv = { container: layoutWrapper };
      this.sidePanel = new SidePanel('left', 260, sidePanelEnv);

      this.sidePanel.toolSettingsSection = this.sidePanel.addSection(
        'setup',
        'Tool Settings',
        true
      );
      this.sidePanel.compassSection = this.sidePanel.addSection(
        'compass',
        'Compass Controls',
        true
      );
      this.sidePanel.p2pSection = this.sidePanel.addSection(
        'p2p',
        'Controller',
        false
      );

      this.baseController.sidePanel = this.sidePanel;
      layoutWrapper.insertBefore(this.sidePanel.element, canvasContainer);
      this._setupToolSettingsWatcher();

      if (typeof CadStorageManager !== 'undefined') {
        this.storageManager = new CadStorageManager(this.baseController);
        this.storageManager.renderUI();
      }

      this.sidePanel.open();
    } else {
      this.sidePanel = null;
    }

    // AccuDraw custom parameters update if already created by ControllerSetup
    if (this.baseController.accuDraw) {
      this.baseController.accuDraw.update({
        squircleAmount: opts.squircle,
        center: opts.compassCenter || [0, 0, 0],
        color: opts.compassColor || 0x00f2fe,
        size: opts.compassSize
      });
    }

    if (opts.initialPlane) {
      this.baseController.setDrawingPlane(opts.initialPlane);
    }
    if (opts.initialTool) {
      this.baseController.setCommandByName(opts.initialTool);
    }

    // Preset geometry generation
    if (opts.presetGeometry === 'bracket') {
      if (typeof RectangleElement !== 'undefined') {
        const rect = new RectangleElement([-1.2, -0.8, 0], [1.2, 0.8, 0], [
          [1, 0, 0], [0, 0, -1], [0, 1, 0]
        ]);
        rect.color = '#38bdf8';
        this.baseController.cadElements.push(rect);
        ElementOperations.rebuildPermanentVisual(this.baseController, rect);

        const box3d = new RectangleElement([0.4, 0.4, 0], [1.6, 1.4, 0.9], [
          [1, 0, 0], [0, 1, 0], [0, 0, 1]
        ]);
        box3d.color = '#10b981';
        this.baseController.cadElements.push(box3d);
        ElementOperations.rebuildPermanentVisual(this.baseController, box3d);
      }
    } else if (opts.presetGeometry === 'primitives' && typeof Simple3dShapes !== 'undefined') {
      Simple3dShapes.buildPrimitives(this.app, this.threeDView.scene);
    }

    BaseController.activeController = this.baseController;

    const initialRect = parentElement.getBoundingClientRect();
    if (initialRect.width > 0 && initialRect.height > 0) {
      this.app.resize(initialRect.width, initialRect.height);
    }

    console.log('[accuCad] Application initialized successfully.');
    return this;
  }
  destroy() {
      console.log('[accuCad] destroy() called.');

      // Close the P2P connection and dialog
      if (this.baseController && this.baseController.p2pConnector) {
        try {
          this.baseController.p2pConnector.destroy();
        } catch (e) {}
      }

      // Surgically close the active keyboard shortcut help dialog if present
      if (this.baseController && this.baseController._helpDialog) {
        try {
          this.baseController._helpDialog.close();
        } catch (e) {}
        this.baseController._helpDialog = null;
      }

      // Surgically close camera oscillation dialog
      if (typeof CameraOrbitAnimator !== 'undefined') {
        try {
          CameraOrbitAnimator.stop();
        } catch (e) {}
      }

      if (this.app && typeof this.app.destroy === 'function') {
        this.app.destroy();
      }

      if (this.canvasContainer) {
        this.canvasContainer.remove();
      }

      if (this.layoutWrapper) {
        this.layoutWrapper.remove();
      }

      if (
        typeof KeyCommandHandler !== 'undefined' &&
        typeof KeyCommandHandler.destroy === 'function'
      ) {
        KeyCommandHandler.destroy();
      }

      // Surgically clean up View Controls
      if (typeof ViewControlsManager !== 'undefined') {
        try {
          ViewControlsManager.destroy();
        } catch (e) {}
      }

      if (this.baseController) {
        if (
          this.baseController.accuDrawDiagnostics &&
          this.baseController.accuDrawDiagnostics.dialog
        ) {
          try {
            this.baseController.accuDrawDiagnostics.dialog.close();
          } catch (e) {}
        }
        if (
          this.baseController.accuDrawTestHarness &&
          typeof this.baseController.accuDrawTestHarness.destroy === 'function'
        ) {
          try {
            this.baseController.accuDrawTestHarness.destroy();
          } catch (e) {}
        }
        if (this.baseController.accuDraw && this.baseController.accuDraw.ui) {
          if (typeof this.baseController.accuDraw.ui.destroy === 'function') {
            try {
              this.baseController.accuDraw.ui.destroy();
            } catch (e) {}
          } else {
            try {
              this.baseController.accuDraw.ui.hide();
            } catch (e) {}
          }
        }
      }

      this.storageManager = null;
      this.rootElement = null;
      this.canvasContainer = null;
      this.layoutWrapper = null;
      this.app = null;
      this.baseController = null;
      this.threeDView = null;
    }

  _setupToolSettingsWatcher() {
    this.toolSliders = {};
    const render = () => {
      if (!this.sidePanel || !this.sidePanel.toolSettingsSection) return;
      this.sidePanel.toolSettingsSection.innerHTML = '';
      this.toolSliders = {};

      const controller = this.baseController;
      if (!controller) return;

      const activeCmd = controller.activeCommand;
      const cmdName = activeCmd
        ? activeCmd.constructor
          ? activeCmd.constructor.name
          : 'Unknown'
        : 'None';

      const friendlyNames = {
        DrawRectangleCommand: 'Rectangle Tool',
        DrawArcCommand: 'Arc Tool',
        DrawPathCommand: 'Rounding Tool',
        DrawCurveCommand: 'On-Curve Spline Tool',
        DrawCircleCommand: 'Circle Tool',
        DrawCapsuleCommand: 'Capsule Tool',
        DeleteElementCommand: 'Delete Tool',
        MoveElementCommand: 'Move Element Tool',
        RotateElementCommand: 'Rotate Element Tool',
        ScaleElementCommand: 'Scale Element Tool'
      };
      const displayName =
        friendlyNames[cmdName] || cmdName.replace('Command', ' Tool');

      if (
        this.sidePanel.sectionObjects &&
        this.sidePanel.sectionObjects['setup']
      ) {
        this.sidePanel.sectionObjects['setup'].header.textContent = displayName;
      }

      const showGlobalSettings = !activeCmd || !activeCmd.excludeGlobalSettings;

      if (showGlobalSettings) {
        const colorContainer = document.createElement('div');
        colorContainer.style.cssText =
          'display: flex; align-items: center; justify-content: space-between; padding: 4px 0; margin-bottom: 8px;';

        const colorLabel = document.createElement('div');
        colorLabel.style.cssText =
          'font-size: 11px; color: #aaa; text-transform: uppercase; font-weight: bold;';
        colorLabel.textContent = 'Drawing Color';

        const swatch = document.createElement('div');
        swatch.className = 'drawing-color-swatch-picker';
        swatch.style.cssText = `width: 42px; height: 20px; border-radius: 4px; background-color: ${
          controller.currentColor || '#00ff00'
        }; border: 1px solid #555; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.5);`;

        controller.colorSwatchPicker = swatch;

        swatch.onclick = (e) => {
          e.stopPropagation();
          const picker = new ColorPicker();
          picker.openSmartPicker(
            swatch,
            controller.currentColor || '#00ff00',
            (newColor) => {
              swatch.style.backgroundColor = newColor;
              controller.setColor(newColor);
              controller.refreshMousePosition();
            }
          );
        };

        colorContainer.appendChild(colorLabel);
        colorContainer.appendChild(swatch);
        this.sidePanel.toolSettingsSection.appendChild(colorContainer);

        const widthSlider = new SliderControl({
          label: 'line thickness',
          min: 1,
          max: 20,
          initialValue: controller.lineWidth || 2,
          showValue: true,
          callback: (val) => {
            controller.setLineWidth(Math.round(val));
            controller.refreshMousePosition();
          },
        });
        this.sidePanel.toolSettingsSection.appendChild(widthSlider.container);
        this.toolSliders['lineWidth'] = widthSlider;
      }

      // Dynamic command settings (sliders and checkboxes declared by the active command)
      const hasCustomSettings = activeCmd && typeof activeCmd.getCommandSettings === 'function';

      if (hasCustomSettings) {
        const customSettings = activeCmd.getCommandSettings();
        customSettings.forEach((setting) => {
          if (setting.type === 'checkbox') {
            const row = document.createElement('div');
            row.className = 'tool-setting-checkbox-row';
            row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 6px 0; margin-bottom: 4px;';

            const label = document.createElement('div');
            label.style.cssText = 'font-size: 11px; color: #aaa; text-transform: uppercase; font-weight: bold;';
            label.textContent = setting.label;

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = !!setting.value;
            input.setAttribute('tabindex', '-1');
            input.style.cssText = 'cursor: pointer; width: 16px; height: 16px; accent-color: #00e676;';
            input.onchange = (e) => {
              setting.callback(e.target.checked);
            };

            input.addEventListener('focus', () => {
              input.blur();
              controller.domElement.focus();
            });

            row.appendChild(label);
            row.appendChild(input);
            this.sidePanel.toolSettingsSection.appendChild(row);
          } else if (setting.type === 'slider') {
            const slider = new SliderControl({
              label: setting.label,
              min: setting.min !== undefined ? setting.min : 0.1,
              max: setting.max !== undefined ? setting.max : 2.0,
              step: setting.step !== undefined ? setting.step : 0.05,
              initialValue: setting.value !== undefined ? setting.value : 0.5,
              showValue: true,
              directEntry: true,
              callback: (val) => {
                setting.callback(val);
              }
            });
            this.sidePanel.toolSettingsSection.appendChild(slider.container);
            this.toolSliders[setting.id] = slider;
          }
        });
      }

      controller.toolSliders = this.toolSliders;

      if (
        window.ViewControlsManager &&
        window.ViewControlsManager.instance &&
        typeof window.ViewControlsManager.instance._updateSlidersHighlighting === 'function'
      ) {
        window.ViewControlsManager.instance._updateSlidersHighlighting();
      }
    };

    window.addEventListener('accucad-tool-changed', () => {
      render();
    });

    render();
  }
}
if (typeof window !== 'undefined') window.Main = Main;
globalThis.Main = Main;
if (typeof module !== 'undefined' && module.exports) module.exports = Main;
