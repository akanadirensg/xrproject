"use strict";
import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { createGround } from "./entities/ground";
import { createCity } from "./entities/city";
import { createMouse } from "./entities/mouse";
import { show3DNotification } from "./entities/TextMesh";

const PLAYER_RADIUS = 0.4;
const CATCH_DISTANCE = 3;
const PLAYER_HEIGHT = 0.5;

export function initScene(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer,
) {
  const world = new THREE.Group();
  world.name = "WORLD_ROOT";
  scene.add(world);
  world.position.set(0, 0, 0);

  scene.fog = new THREE.FogExp2("#b8f4f5", 0.018);

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor("#53EAED", 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const groundGroup = new THREE.Group();
  const buildingsGroup = new THREE.Group();
  const roadsGroup = new THREE.Group();
  world.add(groundGroup);
  world.add(buildingsGroup);
  world.add(roadsGroup);
  groundGroup.add(createGround());

  const citySize = 5;
  createCity(buildingsGroup, roadsGroup, citySize);

  // --- Lumières principales ---
  const dirLight = new THREE.DirectionalLight(0xfff5e0, 1.4);
  dirLight.position.set(60, 120, 60);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.near = 1;
  dirLight.shadow.camera.far = 400;
  dirLight.shadow.camera.left = dirLight.shadow.camera.bottom = -80;
  dirLight.shadow.camera.right = dirLight.shadow.camera.top = 80;
  world.add(dirLight);

  const ambientLight = new THREE.AmbientLight(0xd0f0ff, 0.9);
  world.add(ambientLight);

  // --- XR Lighting Estimation ---
  let xrLightEstimation = false;
  let lightProbe: THREE.LightProbe | null = null;
  let estimationDirectionalLight: THREE.DirectionalLight | null = null;

  function setupXRLightEstimation(session: XRSession) {
    if (!("requestLightProbe" in session)) return;

    (session as any)
      .requestLightProbe()
      .then((probe: any) => {
        xrLightEstimation = true;

        lightProbe = new THREE.LightProbe();
        world.add(lightProbe!);

        estimationDirectionalLight = new THREE.DirectionalLight(0xffffff, 0);
        estimationDirectionalLight.castShadow = true;
        estimationDirectionalLight.shadow.mapSize.set(1024, 1024);
        estimationDirectionalLight.shadow.camera.near = 0.1;
        estimationDirectionalLight.shadow.camera.far = 20;
        estimationDirectionalLight.shadow.camera.left = -5;
        estimationDirectionalLight.shadow.camera.right = 5;
        estimationDirectionalLight.shadow.camera.top = 5;
        estimationDirectionalLight.shadow.camera.bottom = -5;
        world.add(estimationDirectionalLight!);

        dirLight.intensity = 0;
        ambientLight.intensity = 0;

        probe.addEventListener("reflectionchange", () => {
          if (!lightProbe) return;
          const sh = probe.probeSphericalHarmonics;
          if (sh) lightProbe.sh.fromArray(sh.coefficients);
        });
      })
      .catch(() => {});
  }

  function updateXRLightEstimation(
    frame: XRFrame,
    referenceSpace: XRReferenceSpace,
  ) {
    if (!xrLightEstimation || !estimationDirectionalLight) return;
    const lightEstimate = (frame as any).getLightEstimate?.(
      (frame as any).session?.preferredReflectionFormat ? undefined : undefined,
    );
    if (!lightEstimate) return;

    const intensity = Math.max(
      lightEstimate.primaryLightIntensity?.x ?? 1,
      0.01,
    );
    estimationDirectionalLight.intensity = intensity;

    const dir = lightEstimate.primaryLightDirection;
    if (dir) {
      estimationDirectionalLight.position.set(
        -dir.x * 10,
        -dir.y * 10 + 5,
        -dir.z * 10,
      );
    }
  }

  // --- Ombre virtuelle sur sol réel (shadow catcher) ---
  const shadowCatcherGeometry = new THREE.PlaneGeometry(200, 200);
  const shadowCatcherMaterial = new THREE.ShadowMaterial({
    opacity: 0.4,
    transparent: true,
    depthWrite: false,
  });
  const shadowCatcher = new THREE.Mesh(
    shadowCatcherGeometry,
    shadowCatcherMaterial,
  );
  shadowCatcher.rotation.x = -Math.PI / 2;
  shadowCatcher.receiveShadow = true;
  shadowCatcher.renderOrder = -1;
  world.add(shadowCatcher);

  // --- Occlusion mesh (sol invisible qui masque le réel) ---
  const occlusionGeometry = new THREE.PlaneGeometry(200, 200);
  const occlusionMaterial = new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: true,
    side: THREE.DoubleSide,
  });
  const occlusionMesh = new THREE.Mesh(occlusionGeometry, occlusionMaterial);
  occlusionMesh.rotation.x = -Math.PI / 2;
  occlusionMesh.position.y = -0.001;
  occlusionMesh.renderOrder = -2;
  world.add(occlusionMesh);

  // --- Occlusion bâtiments : chaque building a un mesh invisible depth-only ---
  function addOcclusionToBuildings() {
    buildingsGroup.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      if (mesh.userData.occlusionAdded) return;
      mesh.userData.occlusionAdded = true;

      const occluder = new THREE.Mesh(
        mesh.geometry,
        new THREE.MeshBasicMaterial({
          colorWrite: false,
          depthWrite: true,
          side: THREE.FrontSide,
        }),
      );
      occluder.renderOrder = -1;
      occluder.position.copy(mesh.position);
      occluder.rotation.copy(mesh.rotation);
      occluder.scale.copy(mesh.scale);
      mesh.parent?.add(occluder);
    });
  }
  setTimeout(addOcclusionToBuildings, 3000);

  // --- Contrôleur XR ---
  const controller1 = renderer.xr.getController(0);
  scene.add(controller1);

  const laserGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -1),
  ]);
  const laserMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
  const laser = new THREE.Line(laserGeometry, laserMaterial);
  laser.name = "XR_LASER";
  laser.scale.z = 5;
  controller1.add(laser);

  const mixers: THREE.AnimationMixer[] = [];
  const listener = new THREE.AudioListener();
  camera.add(listener);
  const audioLoader = new THREE.AudioLoader();

  const bgMusic = new THREE.Audio(listener);
  let wantsMusic = false;
  audioLoader.load("/sounds/bg-sound.mp3", (buf) => {
    bgMusic.setBuffer(buf);
    bgMusic.setLoop(true);
    bgMusic.setVolume(0.3);
    if (wantsMusic && !bgMusic.isPlaying) bgMusic.play();
  });

  const catchSound = new THREE.Audio(listener);
  audioLoader.load("/sounds/catch.mp3", (buf) => {
    catchSound.setBuffer(buf);
    catchSound.setVolume(0.5);
  });

  const gltfLoader = new GLTFLoader();
  let projectileModel: THREE.Object3D | null = null;
  gltfLoader.load("/models/Bullet.glb", (gltf) => {
    projectileModel = gltf.scene;
    projectileModel?.scale.set(0.05, 0.05, 0.05);
  });

  const spacing = 8;
  const cityBoundary = {
    minX: -citySize * spacing,
    maxX: citySize * spacing,
    minZ: -citySize * spacing,
    maxZ: citySize * spacing,
  };

  const mouseData = createMouse(
    scene,
    mixers,
    [buildingsGroup],
    catchSound,
    cityBoundary,
    () => {
      show3DNotification(scene, camera, "Attrapé !");
    },
  );

  setTimeout(() => {
    mouseData.refreshBuildingBoxes();
  }, 3000);

  function shootEnergyBeam(
    from: THREE.Vector3,
    to: THREE.Vector3,
    onComplete: () => void,
  ) {
    if (!projectileModel) {
      onComplete();
      return;
    }

    const projectile = projectileModel.clone(true);
    projectile.position.copy(from);
    scene.add(projectile);

    const direction = new THREE.Vector3().subVectors(to, from);
    const distance = direction.length();
    direction.normalize();

    const speed = 6;
    let traveled = 0;

    function animateProjectile() {
      const step = 0.016 * speed;
      traveled += step;
      if (traveled < distance) {
        projectile.position.addScaledVector(direction, step);
        projectile.lookAt(to);
        requestAnimationFrame(animateProjectile);
      } else {
        scene.remove(projectile);
        onComplete();
      }
    }

    animateProjectile();
  }

  function onSelectStart(event: any) {
    const controller = event.target;
    const tempMatrix = new THREE.Matrix4();
    tempMatrix.identity().extractRotation(controller.matrixWorld);

    const raycaster = new THREE.Raycaster();
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

    const hits = raycaster.intersectObject(mouseData.group, true);

    if (
      hits.length > 0 &&
      hits[0].distance < CATCH_DISTANCE &&
      !mouseData.isCaught()
    ) {
      const start = new THREE.Vector3().setFromMatrixPosition(
        controller.matrixWorld,
      );
      const end = hits[0].point.clone();

      shootEnergyBeam(start, end, () => {
        mouseData.catchAnimal();
      });

      if (controller.gamepad && controller.gamepad.hapticActuators?.length) {
        controller.gamepad.hapticActuators[0].pulse(0.5, 100);
      }
    }
  }

  controller1.addEventListener("selectstart", onSelectStart);

  const controls = new PointerLockControls(camera, renderer.domElement);
  scene.add(controls.object);

  const interactionRaycaster = new THREE.Raycaster();
  const clock = new THREE.Clock();

  // --- Écoute session XR pour lighting estimation ---
  renderer.xr.addEventListener("sessionstart", () => {
    const session = renderer.xr.getSession();
    if (session) setupXRLightEstimation(session);

    // En mode XR, cacher le sol visible (le shadow catcher suffit)
    groundGroup.visible = false;
  });

  renderer.xr.addEventListener("sessionend", () => {
    groundGroup.visible = true;
    dirLight.intensity = 1.4;
    ambientLight.intensity = 0.9;
    xrLightEstimation = false;
    if (lightProbe) {
      world.remove(lightProbe);
      lightProbe = null;
    }
    if (estimationDirectionalLight) {
      world.remove(estimationDirectionalLight);
      estimationDirectionalLight = null;
    }
  });

  function animate(timestamp?: number, frame?: XRFrame) {
    renderer.setAnimationLoop(animate);
    const delta = Math.min(clock.getDelta(), 0.05);

    if (frame) {
      const referenceSpace = renderer.xr.getReferenceSpace();
      if (referenceSpace) {
        updateXRLightEstimation(frame, referenceSpace as XRReferenceSpace);
      }
    }

    mouseData.update(delta, camera.position);

    for (const mixer of mixers) mixer.update(delta);

    if (controller1) {
      const tempMatrix = new THREE.Matrix4();
      tempMatrix.identity().extractRotation(controller1.matrixWorld);

      interactionRaycaster.ray.origin.setFromMatrixPosition(
        controller1.matrixWorld,
      );
      interactionRaycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

      const hits = interactionRaycaster.intersectObject(mouseData.group, true);

      if (hits.length > 0) {
        laser.scale.z = hits[0].distance;
        laserMaterial.color.set(0x00ff00);
      } else {
        laser.scale.z = 5;
        laserMaterial.color.set(0xff0000);
      }
    }

    renderer.render(scene, camera);
  }

  animate();

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}
