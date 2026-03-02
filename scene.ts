"use strict";
import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

import { createGround } from "./entities/ground";
import { createCity } from "./entities/city";
import { createMouse } from "./entities/mouse";
// import { createHUD } from "./hud";

//  Constantes joueur
const PLAYER_ACCELERATION = 6;
const PLAYER_RADIUS = 0.4;
const CATCH_DISTANCE = 3;
const PLAYER_HEIGHT = 0.5;

//  Score
const BASE_POINTS = 100;

function computePoints(elapsedTime: number): number {
  // La valeur d'une capture augmente avec la difficulté (temps écoulé)
  const difficultyMultiplier = 1 + Math.floor(elapsedTime / 30);
  return BASE_POINTS * difficultyMultiplier;
}
//

export function initScene(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    renderer: THREE.WebGLRenderer,
) {
  //  Scène
//   const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2("#b8f4f5", 0.018);

//   const camera = new THREE.PerspectiveCamera(
//     75,
//     window.innerWidth / window.innerHeight,
//     0.1,
//     1000,
//   );
//   const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor("#53EAED", 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
//   container.appendChild(renderer.domElement);

  //  Groupes
  const world = new THREE.Group();
  const groundGroup = new THREE.Group();
  const buildingsGroup = new THREE.Group();
  const roadsGroup = new THREE.Group();
  scene.add(world);
  world.add(groundGroup);
  world.add(buildingsGroup);
  world.add(roadsGroup);
  groundGroup.add(createGround());

  const citySize = 5;
  createCity(buildingsGroup, roadsGroup, citySize);

  //  Lumières
  const dirLight = new THREE.DirectionalLight(0xfff5e0, 1.4);
  dirLight.position.set(60, 120, 60);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.near = 1;
  dirLight.shadow.camera.far = 400;
  dirLight.shadow.camera.left = dirLight.shadow.camera.bottom = -80;
  dirLight.shadow.camera.right = dirLight.shadow.camera.top = 80;
  scene.add(dirLight);
  scene.add(new THREE.AmbientLight(0xd0f0ff, 0.9));

//   camera.position.set(4.5, PLAYER_HEIGHT, 8.5);

  //  Audio
  const mixers: THREE.AnimationMixer[] = [];
  const listener = new THREE.AudioListener();
  camera.add(listener);
  const audioLoader = new THREE.AudioLoader();

  const bgMusic = new THREE.Audio(listener);
  let wantsMusic = false;
  audioLoader.load("/xrproject/sounds/bg-sound.mp3", (buf) => {
    bgMusic.setBuffer(buf);
    bgMusic.setLoop(true);
    bgMusic.setVolume(0.3);
    if (wantsMusic && !bgMusic.isPlaying) bgMusic.play();
  });

  const catchSound = new THREE.Audio(listener);
  audioLoader.load("/xrproject/sounds/catch.mp3", (buf) => {
    catchSound.setBuffer(buf);
    catchSound.setVolume(0.5);
  });

  //  HUD
//   const hud = createHUD();

  //  Limites
  const spacing = 8;
  const cityBoundary = {
    minX: -citySize * spacing,
    maxX: citySize * spacing,
    minZ: -citySize * spacing,
    maxZ: citySize * spacing,
  };

  //  Créature (mode infini — se respawn automatiquement)
  const mouseData = createMouse(
    scene,
    mixers,
    [buildingsGroup],
    catchSound,
    cityBoundary,
    // hud.getElapsedTime,
    // () => {
    //   // Callback capture : score basé sur la difficulté courante
    //   const points = computePoints(hud.getElapsedTime());
    //   hud.addScore(points);
    // },
  );

  //  Contrôles
  const controls = new PointerLockControls(camera, renderer.domElement);
  scene.add(controls.object);

  renderer.domElement.addEventListener("click", () => {
    controls.lock();
    wantsMusic = true;
    if (bgMusic.buffer && !bgMusic.isPlaying) bgMusic.play();
  });

  const keys: Record<string, boolean> = {};
  window.addEventListener("keydown", (e) => {
    keys[e.code] = true;
    // Touche Échap → quitter et afficher le leaderboard
    if (e.code === "Escape" && controls.isLocked) {
      // PointerLockControls gère déjà l'unlock sur Escape,
      // on affiche le leaderboard au prochain unlock
    }
  });
  window.addEventListener("keyup", (e) => {
    keys[e.code] = false;
  });

  // Afficher le leaderboard quand le joueur déverrouille volontairement (Escape)
  let hasShownLeaderboard = false;
//   controls.addEventListener("unlock", () => {
//     if (!hasShownLeaderboard && hud.getScore() >= 0) {
//       // Petit délai pour laisser le temps au joueur de voir ce qui se passe
//       setTimeout(() => {
//         if (!hasShownLeaderboard) {
//           hasShownLeaderboard = true;
//           if (bgMusic.isPlaying) bgMusic.stop();
//           hud.showLeaderboard(hud.getScore());
//         }
//       }, 400);
//     }
//   });

  //  Collisions bâtiments
  const buildingBoxes: THREE.Box3[] = [];

  function refreshBuildingBoxes() {
    buildingBoxes.length = 0;
    buildingsGroup.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const box = new THREE.Box3().setFromObject(child);
        box.expandByScalar(PLAYER_RADIUS);
        buildingBoxes.push(box);
      }
    });
  }
  setTimeout(refreshBuildingBoxes, 2000);

  function collidesWithBuildings(pos: THREE.Vector3): boolean {
    const testBox = new THREE.Box3(
      new THREE.Vector3(pos.x - PLAYER_RADIUS, 0, pos.z - PLAYER_RADIUS),
      new THREE.Vector3(pos.x + PLAYER_RADIUS, 2, pos.z + PLAYER_RADIUS),
    );
    return buildingBoxes.some((box) => box.intersectsBox(testBox));
  }

//   function movePlayer(
//     delta: number,
//     direction: THREE.Vector3,
//     right: THREE.Vector3,
//   ) {
//     const dist = PLAYER_ACCELERATION * delta;
//     const desired = new THREE.Vector3();
//     if (keys["KeyW"] || keys["ArrowUp"])
//       desired.addScaledVector(direction, dist);
//     if (keys["KeyS"] || keys["ArrowDown"])
//       desired.addScaledVector(direction, -dist);
//     if (keys["KeyA"] || keys["ArrowLeft"])
//       desired.addScaledVector(right, -dist);
//     if (keys["KeyD"] || keys["ArrowRight"])
//       desired.addScaledVector(right, dist);

//     const posX = camera.position.clone();
//     posX.x += desired.x;
//     if (!collidesWithBuildings(posX)) camera.position.x = posX.x;

//     const posZ = camera.position.clone();
//     posZ.z += desired.z;
//     if (!collidesWithBuildings(posZ)) camera.position.z = posZ.z;

//     camera.position.y = PLAYER_HEIGHT;
//   }

  // Raycaster interaction
  const interactionRaycaster = new THREE.Raycaster();

  // Boucle principale
  const clock = new THREE.Clock();

  function animate() {
    renderer.setAnimationLoop(animate);
    const delta = Math.min(clock.getDelta(), 0.05);

    // hud.update(delta);

    if (controls.isLocked) {
      const direction = new THREE.Vector3();
      controls.getDirection(direction);
      direction.y = 0;
      direction.normalize();
      const right = new THREE.Vector3()
        .crossVectors(direction, camera.up)
        .normalize();

    //   movePlayer(delta, direction, right);

      if (keys["KeyE"]) {
        const lookDir = new THREE.Vector3();
        controls.getDirection(lookDir);
        interactionRaycaster.set(camera.position, lookDir);
        const hits = interactionRaycaster.intersectObject(
          mouseData.group,
          true,
        );
        if (
          hits.length > 0 &&
          hits[0].distance < CATCH_DISTANCE &&
          !mouseData.isCaught()
        ) {
          mouseData.catchAnimal();
          // Micro feedback caméra
          camera.position.y += 0.05;
          setTimeout(() => {
            camera.position.y = PLAYER_HEIGHT;
          }, 100);
        }
      }
    }

    mouseData.update(delta, camera.position);

    // Prompt contextuel "Appuie sur E"
    const lookDir = new THREE.Vector3();
    controls.getDirection(lookDir);
    interactionRaycaster.set(camera.position, lookDir);
    const hits = interactionRaycaster.intersectObject(mouseData.group, true);
    // hud.showCatchPrompt(
    //   !mouseData.isCaught() &&
    //     hits.length > 0 &&
    //     hits[0].distance < CATCH_DISTANCE,
    // );

    for (const mixer of mixers) mixer.update(delta);
    renderer.render(scene, camera);
  }

  animate();

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}
