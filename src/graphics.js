import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import {WEBGL} from 'three/addons/WebGL.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';

export const graphics = (function() {
  return {
    Graphics: class {
      constructor(game) {
      }

      Initialize() {
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
        });
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        const target = document.getElementById('target');
        target.appendChild(this.renderer.domElement);

        this._stats = new Stats();
				target.appendChild(this._stats.dom);

        window.addEventListener('resize', () => {
          this._OnWindowResize();
        }, false);

        const fov = 60;
        const aspect = 1920 / 1080;
        const near = 1.0;
        const far = 1000.0;
        this._camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        this._camera.position.set(75, 20, 0);

        this._scene = new THREE.Scene();

        this._addLights();

        const composer = new EffectComposer(this.renderer);
        this._composer = composer;
        this._composer.addPass(new RenderPass(this._scene, this._camera));

        return true;
      }

      _addLights() {
        let light = new THREE.DirectionalLight(0xFFFFFF, 1, 100);
        light.position.set(100, 100, 100);
        light.target.position.set(0, 0, 0);
        light.castShadow = true;
        light.shadowCameraVisible = true;
        light.shadow.bias = -0.01;
        light.shadow.mapSize.width = 2048;
        light.shadow.mapSize.height = 2048;
        light.shadow.camera.near = 1.0;
        light.shadow.camera.far = 500;
        light.shadow.camera.left = 200;
        light.shadow.camera.right = -200;
        light.shadow.camera.top = 200;
        light.shadow.camera.bottom = -200;
        this._scene.add(light);

        light = new THREE.DirectionalLight(0x404040, 1, 100);
        light.position.set(-100, 100, -100);
        light.target.position.set(0, 0, 0);
        light.castShadow = false;
        this._scene.add(light);

        light = new THREE.DirectionalLight(0x404040, 1, 100);
        light.position.set(100, 100, -100);
        light.target.position.set(0, 0, 0);
        light.castShadow = false;
        this._scene.add(light);
      }

      _OnWindowResize() {
        this._camera.aspect = window.innerWidth / window.innerHeight;
        this._camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this._composer.setSize(window.innerWidth, window.innerHeight);
      }

      get Scene() {
        return this._scene;
      }

      Render(timeInSeconds) {
        this._composer.render();
        this._stats.update();
      }
    }
  };
})();
