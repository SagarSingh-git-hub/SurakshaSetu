document.addEventListener('DOMContentLoaded', () => {
  initLoginAnimations();
  initLogin3DScene();
});

function initLoginAnimations() {
  if (typeof gsap === 'undefined') return;

  // Animate login form card
  gsap.to('#login-form-card', {
    y: 0,
    opacity: 1,
    duration: 0.8,
    ease: 'power3.out',
    delay: 0.2
  });

  // Animate badges
  gsap.to('#login-badge-1', {
    y: 0,
    opacity: 1,
    duration: 0.6,
    ease: 'back.out(1.5)',
    delay: 0.6
  });

  gsap.to('#login-badge-2', {
    y: 0,
    opacity: 1,
    duration: 0.6,
    ease: 'back.out(1.5)',
    delay: 0.8
  });
  
  // Fade in canvas
  gsap.to('#login-3d-canvas', {
    opacity: 1,
    duration: 1.2,
    ease: 'power2.inOut',
    delay: 0.3
  });
}

function initLogin3DScene() {
  const container = document.getElementById('login-3d-canvas');
  if (!container || typeof THREE === 'undefined') return;

  // Scene setup
  const scene = new THREE.Scene();
  
  // Camera setup
  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.z = 10;
  
  // Renderer setup
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // optimize performance
  container.appendChild(renderer.domElement);
  
  // Lighting setup for glassmorphism / soft look
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
  scene.add(ambientLight);
  
  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(5, 5, 5);
  scene.add(dirLight);

  const fillLight = new THREE.DirectionalLight(0xaaddff, 0.6);
  fillLight.position.set(-5, 0, 5);
  scene.add(fillLight);

  const backLight = new THREE.DirectionalLight(0x2ecc71, 0.8);
  backLight.position.set(0, -5, -5);
  scene.add(backLight);
  
  // Planet Group
  const planetGroup = new THREE.Group();
  scene.add(planetGroup);
  
  // Main eco-sphere (Glass-like material)
  const sphereGeo = new THREE.SphereGeometry(2.8, 64, 64);
  const sphereMat = new THREE.MeshPhysicalMaterial({
    color: 0x147a3d,
    metalness: 0.1,
    roughness: 0.2,
    transmission: 0.6, // glass-like
    thickness: 1.5,
    envMapIntensity: 1.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
  });
  const planet = new THREE.Mesh(sphereGeo, sphereMat);
  planetGroup.add(planet);

  // Decorative rings / tech elements
  const ringGeo = new THREE.TorusGeometry(3.6, 0.02, 16, 100);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x2ecc71, transparent: true, opacity: 0.4 });
  const ring1 = new THREE.Mesh(ringGeo, ringMat);
  ring1.rotation.x = Math.PI / 2;
  planetGroup.add(ring1);

  const ringGeo2 = new THREE.TorusGeometry(4.0, 0.01, 16, 100);
  const ring2 = new THREE.Mesh(ringGeo2, ringMat);
  ring2.rotation.x = Math.PI / 3;
  ring2.rotation.y = Math.PI / 6;
  planetGroup.add(ring2);
  
  // Outer wireframe shell
  const wireGeo = new THREE.IcosahedronGeometry(3.1, 2);
  const wireMat = new THREE.MeshBasicMaterial({
    color: 0x2ecc71,
    wireframe: true,
    transparent: true,
    opacity: 0.15
  });
  const wireShell = new THREE.Mesh(wireGeo, wireMat);
  planetGroup.add(wireShell);
  
  // Floating environmental particles
  const particlesGeo = new THREE.BufferGeometry();
  const particlesCount = 250;
  const posArray = new Float32Array(particlesCount * 3);
  
  for(let i=0; i<particlesCount * 3; i++) {
    // distribute in a spherical volume
    const radius = 6 + Math.random() * 4;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1);
    
    posArray[i * 3] = radius * Math.sin(phi) * Math.cos(theta); // x
    posArray[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta); // y
    posArray[i * 3 + 2] = radius * Math.cos(phi); // z
  }
  
  particlesGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  
  // Map a small circular texture for particles if possible, else basic
  const particleMat = new THREE.PointsMaterial({
    size: 0.08,
    color: 0x2ecc71,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending
  });
  
  const particlesMesh = new THREE.Points(particlesGeo, particleMat);
  scene.add(particlesMesh);
  
  // Mouse Interaction Setup
  let mouseX = 0;
  let mouseY = 0;
  let targetX = 0;
  let targetY = 0;
  
  // Only track mouse over the canvas area to avoid conflicting with form inputs
  document.addEventListener('mousemove', (event) => {
    const windowHalfX = window.innerWidth / 2;
    const windowHalfY = window.innerHeight / 2;
    mouseX = (event.clientX - windowHalfX) * 0.0005;
    mouseY = (event.clientY - windowHalfY) * 0.0005;
  });
  
  // Animation Loop
  const clock = new THREE.Clock();
  
  function animate() {
    requestAnimationFrame(animate);
    
    const elapsedTime = clock.getElapsedTime();
    
    // Smooth mouse follow
    targetX = mouseX;
    targetY = mouseY;
    
    // Constant rotation + mouse parallax
    planetGroup.rotation.y += 0.002;
    planetGroup.rotation.x += 0.05 * (targetY - planetGroup.rotation.x);
    planetGroup.rotation.y += 0.05 * (targetX - planetGroup.rotation.y);
    
    // Floating effect
    const floatOffset = Math.sin(elapsedTime * 1.2) * 0.15;
    planetGroup.position.y = floatOffset;
    
    // Rotate rings independently
    ring1.rotation.z += 0.003;
    ring2.rotation.z -= 0.002;
    
    // Rotate particles slowly
    particlesMesh.rotation.y = elapsedTime * 0.03;
    particlesMesh.rotation.z = elapsedTime * 0.01;
    
    renderer.render(scene, camera);
  }
  
  animate();
  
  // Handle window resize gracefully
  window.addEventListener('resize', () => {
    if (!container) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });
}
