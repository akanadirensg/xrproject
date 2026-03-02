import * as THREE from "three";
import { createBuilding } from "./building";
import { createRoad } from "./roads";

export async function createCity(
  buildingsGroup: THREE.Group,
  roadsGroup: THREE.Group,
  size: number,
) {
  const spacing = 8;
  const roadWidth = 8;
  const roadlength = 4;

  const promises: Promise<THREE.Group>[] = [];

  for (let x = -size; x <= size; x++) {
    for (let z = -size; z <= size; z++) {
      const pos = new THREE.Vector3(x * spacing, 0, z * spacing);

      const modelIndex = Math.floor(Math.random() * 3);

      // stockage de la promesse de chargement dans un tableau
      promises.push(
        createBuilding(buildingsGroup, {
          modelIndex,
          position: pos,
        }),
      );
    }
  }

  // Charger tous les bâtiments en parallèle
  await Promise.all(promises);
  console.log("Tous les bâtiments GLB ont été chargés !");

  for (let x = -size - 0.5; x <= size + 0.5; x++) {
    for (let z = -size - 0.5; z <= size + 0.5; z++) {
      createRoad(
        roadsGroup,
        new THREE.Vector3(x * spacing, 0, z * spacing),
        roadWidth,
        roadlength,
      );
    }
  }
  for (let z = -size - 0.5; z <= size + 0.5; z++) {
    for (let x = -size - 0.5; x <= size + 0.5; x++) {
      createRoad(
        roadsGroup,
        new THREE.Vector3(x * spacing, 0, z * spacing),
        roadlength,
        roadWidth,
      );
    }
  }
}
