# City Mouse Chase XR

**City Mouse Chase XR** est une version en **réalité augmentée (WebXR)** du jeu original City Mouse Chase, développée avec **Three.js**.  
Le joueur place une ville miniature dans le monde réel, puis interagit avec des créatures qui s’y déplacent en temps réel.

---

## Concept

Le joueur utilise son appareil (mobile) pour :

1. Scanner une surface réelle (hit-test AR)
2. Placer une ville 3D miniature
3. Observer et interagir avec des créatures animées
4. Les attraper via interaction XR (tap / contrôleur)

---

## Fonctionnalités principales

### Ville en réalité augmentée
- Placement via **hit-test WebXR**
- Échelle réduite (effet diorama)
- Bâtiments GLB chargés dynamiquement

### Interaction XR
- Raycasting depuis contrôleur ou caméra
- Feedback visuel (crosshair / laser)
- Capture avec effet animé

### Intégration AR avancée
- Shadow catcher → ombres réalistes sur le sol réel
- Occlusion sol → masque le monde virtuel sous la surface détectée
- Occlusion bâtiments → objets réels cachés derrière les bâtiments virtuels

### Lighting réaliste (WebXR Light Estimation)
- Utilisation de `requestLightProbe()`
- Éclairage dynamique basé sur l’environnement réel
- Direction et intensité lumineuse adaptées en temps réel

---

## Technologies utilisées

- Three.js (WebXR, rendering, animations)
- GLTFLoader (modèles 3D)
- Raycaster (interactions)
- WebXR API (ARButton, hit-test, light estimation)

---

##  Raycasting

Utilisé pour :

- Interaction joueur → viser et attraper les créatures
- IA → détection d’obstacles et navigation

---

## Gestion des collisions

### Joueur / environnement
- Basé sur AABB (THREE.Box3)
- Empêche les intersections avec bâtiments

### Créatures / bâtiments
- Vérification avant chaque déplacement
- Si collision :
  - Mouvement annulé
  - Nouvelle direction aléatoire

---


## Objectif

Créer une expérience immersive où le joueur interagit avec un monde virtuel intégré dans son environnement réel, en exploitant pleinement les capacités de la réalité augmentée moderne.