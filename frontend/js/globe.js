// ── 3D THREE.JS GLOBE ANIMATION ──
let globeScene, globeCamera, globeRenderer, globePoints, globeGroup;

function initGlobe() {
  const container = document.querySelector('.hero-visual');
  if (!container) return;
  
  const oldCanvas = document.getElementById('globe-canvas');
  if(oldCanvas) oldCanvas.remove();

  if (typeof THREE === 'undefined') return;

  const W = container.clientWidth || 520;
  const H = container.clientHeight || 520;

  globeScene = new THREE.Scene();
  globeCamera = new THREE.PerspectiveCamera(45, W / H, 0.1, 1000);
  globeCamera.position.z = 320; // Pulled back a little for better view

  globeRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
  globeRenderer.setSize(W, H);
  globeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // optimize performance
  
  const globeWrapper = document.createElement('div');
  globeWrapper.className = 'hero-globe';
  globeWrapper.appendChild(globeRenderer.domElement);
  container.appendChild(globeWrapper);
  
  globeRenderer.domElement.style.animation = "floatGlobe 8s ease-in-out infinite";

  globeGroup = new THREE.Group();
  globeScene.add(globeGroup);

  // 1. Core Sphere (Deep oceanic/forest dark)
  const sphereGeo = new THREE.SphereGeometry(100, 64, 64);
  const sphereMat = new THREE.MeshPhongMaterial({
    color: 0x052e16, // Very dark green
    emissive: 0x000000,
    specular: 0x2ecc71,
    shininess: 50,
    transparent: true,
    opacity: 0.9,
  });
  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  globeGroup.add(sphere);

  // 2. High-Tech Wireframe Layer (Inner)
  const wireGeo = new THREE.SphereGeometry(101, 32, 32);
  const wireMat = new THREE.MeshBasicMaterial({
    color: 0x15803d, // Mid green
    wireframe: true,
    transparent: true,
    opacity: 0.15,
    blending: THREE.AdditiveBlending
  });
  const wireframe = new THREE.Mesh(wireGeo, wireMat);
  globeGroup.add(wireframe);

  // 3. Stylized Geometric Overlay (Icosahedron)
  const icoGeo = new THREE.IcosahedronGeometry(104, 2);
  const icoMat = new THREE.MeshBasicMaterial({
    color: 0x4ade80, // Bright pastel green
    wireframe: true,
    transparent: true,
    opacity: 0.1,
    blending: THREE.AdditiveBlending
  });
  const icosahedron = new THREE.Mesh(icoGeo, icoMat);
  globeGroup.add(icosahedron);

  // 4. Glowing Atmosphere (Halo)
  const atmoGeo = new THREE.SphereGeometry(118, 64, 64);
  const atmoMat = new THREE.MeshPhongMaterial({
    color: 0x22c55e,
    transparent: true,
    opacity: 0.08,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const atmosphere = new THREE.Mesh(atmoGeo, atmoMat);
  globeScene.add(atmosphere);

  // 5. Data Rings (Satellites)
  const ringGeo = new THREE.RingGeometry(140, 142, 64);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xa7f3d0,
    transparent: true,
    opacity: 0.2,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending
  });
  const dataRing1 = new THREE.Mesh(ringGeo, ringMat);
  dataRing1.rotation.x = Math.PI / 3;
  dataRing1.rotation.y = Math.PI / 4;
  globeGroup.add(dataRing1);

  const dataRing2 = new THREE.Mesh(ringGeo, ringMat);
  dataRing2.scale.set(1.1, 1.1, 1.1);
  dataRing2.rotation.x = -Math.PI / 3;
  dataRing2.rotation.y = -Math.PI / 6;
  globeGroup.add(dataRing2);

  // 6. Swirling Particles / Stardust
  const partGeo = new THREE.BufferGeometry();
  const partCount = 800; // More particles
  const posArray = new Float32Array(partCount * 3);
  for(let i=0; i<partCount*3; i+=3) {
    const r = 130 + Math.random() * 100;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    posArray[i] = r * Math.sin(phi) * Math.cos(theta);
    posArray[i+1] = r * Math.sin(phi) * Math.sin(theta);
    posArray[i+2] = r * Math.cos(phi);
  }
  partGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  const partMat = new THREE.PointsMaterial({
    size: 2,
    color: 0x6ee7b7,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const particles = new THREE.Points(partGeo, partMat);
  globeScene.add(particles);

  // 7. Lighting setup
  const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
  mainLight.position.set(200, 100, 200);
  globeScene.add(mainLight);

  const backLight = new THREE.DirectionalLight(0x22c55e, 0.8); // Green backlight for rim light effect
  backLight.position.set(-200, 100, -200);
  globeScene.add(backLight);

  const ambient = new THREE.AmbientLight(0xffffff, 0.2);
  globeScene.add(ambient);

  // Group for markers
  globePoints = new THREE.Group();
  globeGroup.add(globePoints);

  // Animation Loop
  const clock = new THREE.Clock();
  
  function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();

    // Rotate core elements
    globeGroup.rotation.y += 0.0015;
    globeGroup.rotation.x = Math.sin(time * 0.3) * 0.1; // Gentle rocking
    
    // Rotate layers independently for parallax
    icosahedron.rotation.y -= 0.0005;
    icosahedron.rotation.z += 0.0005;
    
    dataRing1.rotation.z += 0.002;
    dataRing2.rotation.z -= 0.003;

    // Rotate particles
    particles.rotation.y -= 0.0005;
    particles.rotation.x = Math.sin(time * 0.1) * 0.05;

    globeRenderer.render(globeScene, globeCamera);
  }
  animate();

  // Handle Resize gracefully
  window.addEventListener('resize', () => {
    if(!container) return;
    const newW = container.clientWidth || 520;
    const newH = container.clientHeight || 520;
    globeCamera.aspect = newW / newH;
    globeCamera.updateProjectionMatrix();
    globeRenderer.setSize(newW, newH);
  });
}

function updateGlobeMarkers(reports) {
  if (!globePoints) return;
  
  // Clear old markers
  while(globePoints.children.length > 0){ 
      globePoints.remove(globePoints.children[0]); 
  }

  if(!reports || reports.length === 0) return;

  const R = 100; // Surface of the core sphere
  
  reports.forEach(r => {
    // Map Haldwani coordinates roughly to globe surface for visual effect
    const lat = (r.lat - 29.2183) * 35; // Spread them out more visually
    const lng = (r.lng - 79.5130) * 35;
    
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);

    const x = -(R * Math.sin(phi) * Math.cos(theta));
    const z = (R * Math.sin(phi) * Math.sin(theta));
    const y = (R * Math.cos(phi));

    const color = r.status === 'Resolved' ? 0x22c55e : 0xf87171; // Tailwind Green / Red
    
    // 1. Data Pillar (Cylinder sticking out)
    const pillarHeight = 8 + Math.random() * 12;
    const pillarGeo = new THREE.CylinderGeometry(0.5, 0.5, pillarHeight, 8);
    // Shift geometry up so it scales from the base
    pillarGeo.translate(0, pillarHeight/2, 0); 
    const pillarMat = new THREE.MeshBasicMaterial({ 
      color: color, 
      transparent: true, 
      opacity: 0.7,
      blending: THREE.AdditiveBlending 
    });
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    
    // Position on surface
    pillar.position.set(x, y, z);
    // Orient outwards from center
    pillar.lookAt(x * 2, y * 2, z * 2);
    // Cylinder by default points up (Y). We need to rotate it to point towards Z (lookAt direction)
    pillar.rotateX(Math.PI / 2);

    // 2. Base Ring / Ripple
    const ringGeo = new THREE.RingGeometry(1.5, 3, 16);
    const ringMat = new THREE.MeshBasicMaterial({ 
      color: color, 
      transparent: true, 
      opacity: 0.8, 
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(x, y, z);
    ring.lookAt(x*2, y*2, z*2);

    globePoints.add(pillar);
    globePoints.add(ring);
  });
}

// Initialize globe
window.addEventListener('DOMContentLoaded', initGlobe);
