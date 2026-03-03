import * as THREE from "three";


function createTextMesh(message: string, height = 0.3) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d")!;
  const fontSize = 100;

  context.font = `bold ${fontSize}px Arial`;
  const textWidth = context.measureText(message).width;

  canvas.width = textWidth;
  canvas.height = fontSize;
  context.font = `bold ${fontSize}px Arial`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#f7d334";
  context.fillText(message, textWidth / 2, fontSize / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
  });

  const geometry = new THREE.PlaneGeometry((height * textWidth) / fontSize, height);
  const mesh = new THREE.Mesh(geometry, material);
  return mesh;
}


export function show3DNotification(scene: THREE.Scene, camera: THREE.Camera, message: string, duration = 1500) {
  const label = createTextMesh(message, 0.3);

  // Positionner devant la caméra
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  label.position.copy(camera.position).add(forward.multiplyScalar(1.5));

  // Faire face à la caméra
  label.quaternion.copy(camera.quaternion);

  scene.add(label);

  const startTime = performance.now();

  function animateLabel() {
    const elapsed = performance.now() - startTime;
    if (elapsed < duration) {
      label.position.y += 0.0015;
      requestAnimationFrame(animateLabel);
    } else {
      scene.remove(label);
      label.geometry.dispose();
      label.material.map?.dispose();
      label.material.dispose();
    }
  }

  animateLabel();
}