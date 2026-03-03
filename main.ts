import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { initScene } from "./scene";

let camera: THREE.PerspectiveCamera, scene: THREE.Scene, renderer: THREE.WebGLRenderer;
let reticle: THREE.Mesh;
let hitTestSource: XRHitTestSource | null = null;
let hitTestSourceRequested = false;
let cityPlaced = false;

init();

function init() {
  const container = document.createElement('div');
  document.body.appendChild(container);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

  const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 3);
  light.position.set(0.5, 1, 0.25);
  scene.add(light);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  container.appendChild(renderer.domElement);

  reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  const controller = renderer.xr.getController(0);
  controller.addEventListener('select', onSelect);
  scene.add(controller);

  document.body.appendChild(
    ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] })
  );

  renderer.setAnimationLoop(animate);
}

function onSelect() {
  if (!reticle.visible || cityPlaced) return;
  cityPlaced = true;

  initScene(scene, camera, renderer);

  const world = scene.getObjectByName("WORLD_ROOT");
  if (world) {
    reticle.matrix.decompose(world.position, world.quaternion, new THREE.Vector3());
    world.scale.setScalar(0.05);
  }
}



function animate(timestamp: number, frame?: XRFrame) {
  if (frame) {
    const referenceSpace = renderer.xr.getReferenceSpace()!;
    const session = renderer.xr.getSession()!;

    if (!hitTestSourceRequested) {
      session.requestReferenceSpace('viewer').then((vs) => {
        session.requestHitTestSource?.({ space: vs })?.then((src) => {
          hitTestSource = src;
        });
      });
      session.addEventListener('end', () => {
        hitTestSourceRequested = false;
        hitTestSource = null;
        cityPlaced = false; 
      });
      hitTestSourceRequested = true;
    }

    if (hitTestSource && !cityPlaced) {
      const results = frame.getHitTestResults(hitTestSource);
      if (results.length > 0) {
        const pose = results[0].getPose(referenceSpace);
        if (pose) {
          reticle.visible = true;
          reticle.matrix.fromArray(pose.transform.matrix);
        }
      } else {
        reticle.visible = false;
      }
    }

  }

  renderer.render(scene, camera);
}