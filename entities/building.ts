import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export function createBuilding(
  buildingsGroup: THREE.Group,
  options: any,
): Promise<THREE.Group> {
  const { modelIndex = 0, position = new THREE.Vector3(0, 0, 0) } = options;
  const modelPath = `/3dgame/models/Building 0${modelIndex}.glb`;

  const buildingGroup = new THREE.Group();
  buildingGroup.position.copy(position);

  const loader = new GLTFLoader();

  return new Promise((resolve, reject) => {
    loader.load(
      modelPath,
      (gltf) => {
        const model = gltf.scene;

        // Définir le scale selon le modèle
        let scale = 1;
        if (modelIndex === 0) scale = 12;
        else if (modelIndex === 1) scale = 2;
        else if (modelIndex === 2) scale = 6;
        else scale = 4;

        model.scale.set(scale, scale, scale);

        // Calculer la bounding box **après scale**
        const box = new THREE.Box3().setFromObject(model);
        const height = box.max.y - box.min.y;

        // Ajuster la position verticale
        if (modelIndex === 0) model.position.y = height / 2 + 3;
        else if (modelIndex === 1) model.position.y = 0;
        else if (modelIndex === 2) model.position.y = height / 2;
        else model.position.y = height / 2;

        buildingGroup.add(model);
        buildingsGroup.add(buildingGroup);

        resolve(buildingGroup);
      },
      undefined,
      (err) => reject(err),
    );
  });
}
