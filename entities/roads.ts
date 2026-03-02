import * as THREE from 'three';

export function createRoad(
  roadsGroup: THREE.Group,
  position: THREE.Vector3,
  width: number,
  length: number
) {
  const geometry = new THREE.BoxGeometry(width, 0.1, length);
  const material = new THREE.MeshStandardMaterial({ color: 0x333333 });
  const road = new THREE.Mesh(geometry, material);

  road.position.copy(position);
  road.position.y = 0.05;

  roadsGroup.add(road);

  return road;
}
