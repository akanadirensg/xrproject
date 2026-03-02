import * as THREE from 'three';

export function createGround(): THREE.Mesh {

    const geometry = new THREE.PlaneGeometry(200, 200);
    const material = new THREE.MeshStandardMaterial({
      color: "#28DE59",
      roughness: 1,
      metalness: 0
    });

    const ground = new THREE.Mesh(geometry, material);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;

    return ground;
  }
