import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {graphics} from './graphics.js';

export const game = (function() {
  return {
    Game: class {
      constructor() {
        this._Initialize();
      }

      _Initialize() {
        this._graphics = new graphics.Graphics(this);
        if (!this._graphics.Initialize()) {
          return;
        }

        this._controls = this._CreateControls();
        this._previousRAF = null;

        this._OnInitialize();
        this._RAF();
      }

      _CreateControls() {
        const controls = new OrbitControls(
            this._graphics._camera, this._graphics.renderer.domElement);
        controls.target.set(0, 0, 0);
        controls.update();
        return controls;
      }

      _DisplayError(errorText) {
        const error = document.getElementById('error');
        error.innerText = errorText;
      }

      _RAF() {
        requestAnimationFrame((t) => {
          if (this._previousRAF === null) {
            this._previousRAF = t;
          }
          this._Render(t - this._previousRAF);
          this._previousRAF = t;
        });
      }

      _Render(timeInMS) {
        const timeInSeconds = timeInMS * 0.001;
        this._OnStep(timeInSeconds);
        this._graphics.Render(timeInSeconds);

        this._RAF();
      }
    }
  };
})();
