let login3dInitialized = false;
let loginContainer = null;
let loginCamera = null;
let loginRenderer = null;

function initLoginAnimations() {
  const targets = ['#login-form-card', '#login-badge-1', '#login-badge-2', '#login-3d-canvas'];
  if (typeof gsap === 'undefined') {
    targets.forEach(sel => {
      const el = document.querySelector(sel);
      if (el) { el.style.opacity = '1'; el.style.transform = 'none'; }
    });
    return;
  }

  gsap.killTweensOf(targets);

  gsap.to('#login-form-card', {
    y: 0,
    opacity: 1,
    duration: 0.8,
    ease: 'power3.out',
    delay: 0.2
  });

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

  if (login3dInitialized) {
    window.triggerLoginResize();
    return;
  }

  container.querySelectorAll('canvas').forEach(c => c.remove());
  loginContainer = container;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 10;
  loginCamera = camera;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);
  loginRenderer = renderer;

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

  const planetGroup = new THREE.Group();
  scene.add(planetGroup);

  const sphereGeo = new THREE.SphereGeometry(2.8, 64, 64);
  const sphereMat = new THREE.MeshPhysicalMaterial({
    color: 0x147a3d,
    metalness: 0.1,
    roughness: 0.2,
    transmission: 0.6,
    thickness: 1.5,
    envMapIntensity: 1.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
  });
  const planet = new THREE.Mesh(sphereGeo, sphereMat);
  planetGroup.add(planet);

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

  const wireGeo = new THREE.IcosahedronGeometry(3.1, 2);
  const wireMat = new THREE.MeshBasicMaterial({
    color: 0x2ecc71,
    wireframe: true,
    transparent: true,
    opacity: 0.15
  });
  const wireShell = new THREE.Mesh(wireGeo, wireMat);
  planetGroup.add(wireShell);

  const particlesGeo = new THREE.BufferGeometry();
  const particlesCount = 250;
  const posArray = new Float32Array(particlesCount * 3);

  for (let i = 0; i < particlesCount * 3; i++) {
    const radius = 6 + Math.random() * 4;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1);

    posArray[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    posArray[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    posArray[i * 3 + 2] = radius * Math.cos(phi);
  }

  particlesGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

  const particleMat = new THREE.PointsMaterial({
    size: 0.08,
    color: 0x2ecc71,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending
  });

  const particlesMesh = new THREE.Points(particlesGeo, particleMat);
  scene.add(particlesMesh);

  let mouseX = 0;
  let mouseY = 0;
  let targetX = 0;
  let targetY = 0;

  document.addEventListener('mousemove', (event) => {
    const windowHalfX = window.innerWidth / 2;
    const windowHalfY = window.innerHeight / 2;
    mouseX = (event.clientX - windowHalfX) * 0.0005;
    mouseY = (event.clientY - windowHalfY) * 0.0005;
  });

  const clock = new THREE.Clock();
  let loginAnimId = null;
  let loginIsAnimating = false;

  function animate() {
    if (!loginIsAnimating) return;
    loginAnimId = requestAnimationFrame(animate);

    const elapsedTime = clock.getElapsedTime();

    targetX = mouseX;
    targetY = mouseY;

    planetGroup.rotation.y += 0.002;
    planetGroup.rotation.x += 0.05 * (targetY - planetGroup.rotation.x);
    planetGroup.rotation.y += 0.05 * (targetX - planetGroup.rotation.y);

    const floatOffset = Math.sin(elapsedTime * 1.2) * 0.15;
    planetGroup.position.y = floatOffset;

    ring1.rotation.z += 0.003;
    ring2.rotation.z -= 0.002;

    particlesMesh.rotation.y = elapsedTime * 0.03;
    particlesMesh.rotation.z = elapsedTime * 0.01;

    renderer.render(scene, camera);
  }

  window.resumeLoginAnimation = function() {
    if (!loginIsAnimating) {
      loginIsAnimating = true;
      animate();
    }
  };

  window.stopLoginAnimation = function() {
    loginIsAnimating = false;
    if (loginAnimId) {
      cancelAnimationFrame(loginAnimId);
      loginAnimId = null;
    }
  };

  window.triggerLoginResize = function() {
    if (!loginContainer || !loginRenderer || !loginCamera) return;
    const w = loginContainer.clientWidth;
    const h = loginContainer.clientHeight;
    if (w === 0 || h === 0) return false;
    loginCamera.aspect = w / h;
    loginCamera.updateProjectionMatrix();
    loginRenderer.setSize(w, h);
    return true;
  };

  window.addEventListener('resize', window.triggerLoginResize);

  login3dInitialized = true;
  window.triggerLoginResize();
}

window.initLogin3DScene = initLogin3DScene;
window.initLoginAnimations = initLoginAnimations;
