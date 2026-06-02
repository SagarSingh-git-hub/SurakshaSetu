// ── 3D THREE.JS GLOBE ANIMATION ──
let globeScene, globeCamera, globeRenderer, globePoints;

function initGlobe() {
  const container = document.querySelector('.hero-visual');
  if (!container) return; // Prevent error if container is missing
  
  const oldCanvas = document.getElementById('globe-canvas');
  if(oldCanvas) oldCanvas.remove(); // Remove the 2D canvas

  if (typeof THREE === 'undefined') return;

  const W = 520, H = 520;

  globeScene = new THREE.Scene();
  globeCamera = new THREE.PerspectiveCamera(45, W / H, 0.1, 1000);
  globeCamera.position.z = 250;

  globeRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  globeRenderer.setSize(W, H);
  globeRenderer.setPixelRatio(window.devicePixelRatio);
  
  const globeWrapper = document.createElement('div');
  globeWrapper.className = 'hero-globe';
  globeWrapper.appendChild(globeRenderer.domElement);
  container.appendChild(globeWrapper);
  
  // Apply floating animation class to the canvas
  globeRenderer.domElement.style.animation = "floatGlobe 6s ease-in-out infinite";

  // 1. Core Sphere (Glassy look)
  const sphereGeo = new THREE.SphereGeometry(100, 64, 64);
  const sphereMat = new THREE.MeshPhongMaterial({
    color: 0xe8faf0,
    transparent: true,
    opacity: 0.8,
    shininess: 100,
  });
  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  globeScene.add(sphere);

  // 2. Wireframe / Grid
  const wireGeo = new THREE.SphereGeometry(102, 32, 32);
  const wireMat = new THREE.MeshBasicMaterial({
    color: 0x2ecc71,
    wireframe: true,
    transparent: true,
    opacity: 0.15
  });
  const wireframe = new THREE.Mesh(wireGeo, wireMat);
  globeScene.add(wireframe);

  // 3. Glowing Atmosphere
  const atmoGeo = new THREE.SphereGeometry(112, 32, 32);
  const atmoMat = new THREE.MeshBasicMaterial({
    color: 0x147a3d,
    transparent: true,
    opacity: 0.05,
    side: THREE.BackSide
  });
  const atmosphere = new THREE.Mesh(atmoGeo, atmoMat);
  globeScene.add(atmosphere);

  // 4. Particles / Stars around globe
  const partGeo = new THREE.BufferGeometry();
  const partCount = 400;
  const posArray = new Float32Array(partCount * 3);
  for(let i=0; i<partCount*3; i+=3) {
    const r = 120 + Math.random() * 80;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    posArray[i] = r * Math.sin(phi) * Math.cos(theta);
    posArray[i+1] = r * Math.sin(phi) * Math.sin(theta);
    posArray[i+2] = r * Math.cos(phi);
  }
  partGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  const partMat = new THREE.PointsMaterial({
    size: 1.5,
    color: 0x8dd9aa,
    transparent: true,
    opacity: 0.6
  });
  const particles = new THREE.Points(partGeo, partMat);
  globeScene.add(particles);

  // 5. Lighting
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(100, 100, 100);
  globeScene.add(light);
  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  globeScene.add(ambient);

  // Group for markers
  globePoints = new THREE.Group();
  globeScene.add(globePoints);

  function animate() {
    requestAnimationFrame(animate);
    sphere.rotation.y += 0.002;
    wireframe.rotation.y += 0.002;
    globePoints.rotation.y += 0.002;
    particles.rotation.y -= 0.0005;
    particles.rotation.x += 0.0002;
    globeRenderer.render(globeScene, globeCamera);
  }
  animate();
}

function updateGlobeMarkers(reports) {
  if (!globePoints) return;
  
  // Clear old markers
  while(globePoints.children.length > 0){ 
      globePoints.remove(globePoints.children[0]); 
  }

  if(!reports || reports.length === 0) return;

  const R = 104; // Slightly above wireframe
  
  reports.forEach(r => {
    // Map Agra coordinates roughly to globe surface for visual effect
    const lat = (r.lat - 27.18) * 25; // Exaggerate spacing
    const lng = (r.lng - 78.01) * 25;
    
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);

    const x = -(R * Math.sin(phi) * Math.cos(theta));
    const z = (R * Math.sin(phi) * Math.sin(theta));
    const y = (R * Math.cos(phi));

    const color = r.status === 'Resolved' ? 0x22c55e : 0xff4444;
    
    // Create glowing dot
    const dotGeo = new THREE.SphereGeometry(2.5, 16, 16);
    const dotMat = new THREE.MeshBasicMaterial({ color: color });
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.set(x, y, z);
    
    // Add outer glow ring
    const ringGeo = new THREE.RingGeometry(3, 5, 16);
    const ringMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(x, y, z);
    ring.lookAt(0,0,0);

    globePoints.add(dot);
    globePoints.add(ring);
  });
}

// Initialize globe
window.addEventListener('DOMContentLoaded', initGlobe);
