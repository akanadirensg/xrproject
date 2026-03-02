

import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { initScene } from "./scene";

let container;
let camera : THREE.PerspectiveCamera, scene : THREE.Scene, renderer : THREE.WebGLRenderer;
let controller1, controller2;

let reticle: THREE.Mesh;

let hitTestSource: XRHitTestSource | null  = null;
let hitTestSourceRequested = false;

init();

// function init() {

//   container = document.createElement( 'div' );
//   document.body.appendChild( container );

//   scene = new THREE.Scene();

//   camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.01, 20 );

//   const light = new THREE.HemisphereLight( 0xffffff, 0xbbbbff, 3 );
//   light.position.set( 0.5, 1, 0.25 );
//   scene.add( light );

//   //

//   renderer = new THREE.WebGLRenderer( { antialias: true, alpha: true } );
//   renderer.setPixelRatio( window.devicePixelRatio );
//   renderer.setSize( window.innerWidth, window.innerHeight );
//   renderer.setAnimationLoop( animate );
//   renderer.xr.enabled = true;
//   container.appendChild( renderer.domElement );

//   //

//   document.body.appendChild( ARButton.createButton( renderer, { requiredFeatures: [ 'hit-test' ] } ) );

//   //

//   const geometry = new THREE.CylinderGeometry( 0.1, 0.1, 0.2, 32 ).translate( 0, 0.1, 0 );

//   function onSelect() {

//     if ( reticle.visible ) {

//       const material = new THREE.MeshPhongMaterial( { color: 0xffffff * Math.random() } );
//       const mesh = new THREE.Mesh( geometry, material );
//       reticle.matrix.decompose( mesh.position, mesh.quaternion, mesh.scale );
//       mesh.scale.y = Math.random() * 2 + 1;
//       scene.add( mesh );

//     }

//   }

//   controller1 = renderer.xr.getController( 0 );
//   controller1.addEventListener( 'select', onSelect );
//   scene.add( controller1 );

//   controller2 = renderer.xr.getController( 1 );
//   controller2.addEventListener( 'select', onSelect );
//   scene.add( controller2 );

//   reticle = new THREE.Mesh(
//     new THREE.RingGeometry( 0.15, 0.2, 32 ).rotateX( - Math.PI / 2 ),
//     new THREE.MeshBasicMaterial()
//   );
//   reticle.matrixAutoUpdate = false;
//   reticle.visible = false;
//   scene.add( reticle );

//   //

//   window.addEventListener( 'resize', onWindowResize );

// }

function init() {

  container = document.createElement('div');
  document.body.appendChild(container);

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.01,
    20
  );

  const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 3);
  light.position.set(0.5, 1, 0.25);
  scene.add(light);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;

  container.appendChild(renderer.domElement);

  document.body.appendChild(
    ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] })
  );

  initScene(scene, camera, renderer);

  renderer.setAnimationLoop(animate);
}

function onWindowResize() {

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize( window.innerWidth, window.innerHeight );

}

//

function animate(timestamp: number, frame?: XRFrame) {

  if (frame) {

    const referenceSpace: XRReferenceSpace = renderer.xr.getReferenceSpace()!;
    const session: XRSession = renderer.xr.getSession()!;

    if (hitTestSourceRequested === false) {

      session.requestReferenceSpace('viewer').then((referenceSpace: XRReferenceSpace) => {

        session.requestHitTestSource?.({ space: referenceSpace })?.then((source: XRHitTestSource) => {

          hitTestSource = source;

        });

      });

      session.addEventListener('end', () => {

        hitTestSourceRequested = false;
        hitTestSource = null;

      });

      hitTestSourceRequested = true;

    }

    if (hitTestSource) {

      const hitTestResults = frame.getHitTestResults(hitTestSource);

      if (hitTestResults.length) {

        const hit = hitTestResults[0];
        const pose = hit.getPose(referenceSpace);

        // if (pose) {
        //   reticle.visible = true;
        //   reticle.matrix.fromArray(pose.transform.matrix);
        // }

      } 
      // else {
      //   reticle.visible = false;
      // }
    }
  }

  renderer.render(scene, camera);
}