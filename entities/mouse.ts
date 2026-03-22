"use strict";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const BASE_SPEED = 2.2;
const MAX_SPEED = 7.5;
const FLEE_RADIUS = 12;
const FLEE_RADIUS_SQ = FLEE_RADIUS * FLEE_RADIUS;
const WANDER_CHANGE_INTERVAL: [number, number] = [0.8, 2.5];
const COLLIDER_DISTANCE = 0.8;
const RESPAWN_DELAY = 2.0;
const ANIMAL_RADIUS = 0.5;

const MODELS = [
  "/models/Crab.gltf",
  "/models/Bee.gltf",
  "/models/Enemy.gltf",
  "/models/Skull.gltf",
];

export function createMouse(
  scene: THREE.Scene,
  mixers: THREE.AnimationMixer[],
  obstacles: THREE.Object3D[],
  catchSound: THREE.Audio,
  cityBoundary: { minX: number; maxX: number; minZ: number; maxZ: number },
  onCatch: () => void,
): {
  group: THREE.Group;
  update: (delta: number, playerPosition: THREE.Vector3) => void;
  catchAnimal: () => void;
  isCaught: () => boolean;
  refreshBuildingBoxes: () => void;
} {
  const group = new THREE.Group();
  const world = scene.getObjectByName("WORLD_ROOT");
  if (world) {
    world.add(group);
  } else {
    scene.add(group);
  }

  const loader = new GLTFLoader();
  let mixer: THREE.AnimationMixer | null = null;
  const buildingBoxes: THREE.Box3[] = [];

  function refreshBuildingBoxes() {
    buildingBoxes.length = 0;
    for (const obstacle of obstacles) {
      obstacle.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const box = new THREE.Box3().setFromObject(child);
          box.expandByScalar(ANIMAL_RADIUS);
          buildingBoxes.push(box);
        }
      });
    }
  }

  function collidesWithBuildings(pos: THREE.Vector3): boolean {
    const testBox = new THREE.Box3(
      new THREE.Vector3(pos.x - ANIMAL_RADIUS, 0, pos.z - ANIMAL_RADIUS),
      new THREE.Vector3(pos.x + ANIMAL_RADIUS, 1.5, pos.z + ANIMAL_RADIUS),
    );
    return buildingBoxes.some((box) => box.intersectsBox(testBox));
  }

  function loadModel() {
    const path = MODELS[Math.floor(Math.random() * MODELS.length)];
    while (group.children.length) group.remove(group.children[0]);
    mixer = null;

    loader.load(path, (gltf) => {
      const model = gltf.scene;
      model.scale.set(3, 3, 3);
      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      group.add(model);

      if (gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(model);
        mixer.clipAction(gltf.animations[0]).play();
        mixers.push(mixer);
      }
    });
  }

  function randomSpawnPosition(): THREE.Vector3 {
    const margin = 4;
    let pos: THREE.Vector3;
    let attempts = 0;
    do {
      const x = THREE.MathUtils.randFloat(
        cityBoundary.minX + margin,
        cityBoundary.maxX - margin,
      );
      const z = THREE.MathUtils.randFloat(
        cityBoundary.minZ + margin,
        cityBoundary.maxZ - margin,
      );
      pos = new THREE.Vector3(x, 0.1, z);
      attempts++;
    } while (collidesWithBuildings(pos) && attempts < 20);
    return pos;
  }

  function spawn() {
    caught = false;
    respawnTimer = 0;
    group.visible = true;
    group.position.copy(randomSpawnPosition());
    wanderAngle = Math.random() * Math.PI * 2;
    panicTimer = 0;
    loadModel();
  }

  let caught = false;
  let respawnTimer = 0;
  let wanderAngle = Math.random() * Math.PI * 2;
  let wanderTimer = 0;
  let nextWanderChange = randomInterval();
  let panicTimer = 0;

  setTimeout(() => {
    refreshBuildingBoxes();
    spawn();
  }, 2500);

  function randomInterval() {
    return (
      WANDER_CHANGE_INTERVAL[0] +
      Math.random() * (WANDER_CHANGE_INTERVAL[1] - WANDER_CHANGE_INTERVAL[0])
    );
  }

  function currentSpeed(elapsed: number): number {
    const t = Math.min(elapsed / 120, 1);
    return BASE_SPEED + (MAX_SPEED - BASE_SPEED) * (t * t);
  }

  function obstacleAvoidance(
    pos: THREE.Vector3,
    desiredDir: THREE.Vector3,
  ): THREE.Vector3 {
    const angles = [-60, -30, 0, 30, 60].map((d) => (d * Math.PI) / 180);
    for (const angle of angles) {
      const testDir = desiredDir
        .clone()
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), angle)
        .normalize();
      const origin = pos.clone();
      origin.y = 0.5;
      const rc = new THREE.Raycaster(origin, testDir);
      const hits = rc.intersectObjects(obstacles, true);
      if (hits.length === 0 || hits[0].distance > COLLIDER_DISTANCE)
        return testDir;
    }
    return desiredDir.clone().negate();
  }

  function clampToBoundary(pos: THREE.Vector3) {
    const margin = 1.5;
    const hitX =
      pos.x < cityBoundary.minX + margin || pos.x > cityBoundary.maxX - margin;
    const hitZ =
      pos.z < cityBoundary.minZ + margin || pos.z > cityBoundary.maxZ - margin;
    pos.x = THREE.MathUtils.clamp(
      pos.x,
      cityBoundary.minX + margin,
      cityBoundary.maxX - margin,
    );
    pos.z = THREE.MathUtils.clamp(
      pos.z,
      cityBoundary.minZ + margin,
      cityBoundary.maxZ - margin,
    );
    if (hitX || hitZ) wanderAngle += Math.PI + (Math.random() - 0.5);
  }

  function update(delta: number, playerPosition: THREE.Vector3) {
    if (caught) {
      respawnTimer += delta;
      if (respawnTimer >= RESPAWN_DELAY) spawn();
      return;
    }

    if (mixer) mixer.update(delta);

    const elapsed = 3;
    const speed = currentSpeed(elapsed);

    const toPlayer = new THREE.Vector3()
      .subVectors(group.position, playerPosition)
      .setY(0);
    const distSq = toPlayer.lengthSq();

    let desiredDir: THREE.Vector3;

    if (distSq < FLEE_RADIUS_SQ) {
      desiredDir = toPlayer.normalize();
      if (distSq < 25) {
        panicTimer += delta;
        desiredDir.applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          Math.sin(panicTimer * 14) * 0.9,
        );
      }
    } else {
      wanderTimer += delta;
      if (wanderTimer >= nextWanderChange) {
        wanderTimer = 0;
        nextWanderChange = randomInterval();
        const maxTurn = THREE.MathUtils.lerp(
          Math.PI / 3,
          Math.PI,
          Math.min(elapsed / 120, 1),
        );
        wanderAngle += (Math.random() - 0.5) * maxTurn * 2;
      }
      desiredDir = new THREE.Vector3(
        Math.sin(wanderAngle),
        0,
        Math.cos(wanderAngle),
      );
    }

    const freeDir = obstacleAvoidance(group.position, desiredDir);

    const candidatePos = group.position
      .clone()
      .addScaledVector(freeDir, speed * delta);
    candidatePos.y = 0.1;
    clampToBoundary(candidatePos);

    if (!collidesWithBuildings(candidatePos)) {
      group.position.copy(candidatePos);
    } else {
      wanderAngle += Math.PI * (0.5 + Math.random());
    }

    const targetAngle = Math.atan2(freeDir.x, freeDir.z);
    const angleDiff =
      THREE.MathUtils.euclideanModulo(
        targetAngle - group.rotation.y + Math.PI,
        Math.PI * 2,
      ) - Math.PI;
    group.rotation.y += angleDiff * Math.min(delta * 10, 1);
  }

  function catchAnimal() {
    if (caught) return;
    caught = true;
    group.visible = false;
    if (catchSound.isPlaying) catchSound.stop();
    catchSound.play();
    onCatch();
  }

  return {
    group,
    update,
    catchAnimal,
    isCaught: () => caught,
    refreshBuildingBoxes,
  };
}
