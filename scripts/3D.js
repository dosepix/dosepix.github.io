import * as THREE from 'https://cdn.skypack.dev/three@0.132.2';
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/controls/OrbitControls';

var what_text = document.getElementById('what-text');
const canvas = document.getElementById('3D-canvas');
var camera, controls, scene, renderer;

function init() {
    camera = new THREE.PerspectiveCamera(40, canvas.getBoundingClientRect().width / canvas.getBoundingClientRect().width, 0.1, 50);
    camera.position.set(3, 3, 4);
    const cameraHelper = new THREE.CameraHelper(camera);

    scene = new THREE.Scene();
    scene.background = new THREE.Color().setHSL(0.6, 0.3, 0.9);
    scene.fog = new THREE.Fog(scene.background, 1, 60);
    // scene.add(cameraHelper);

    // CONTROLS
    controls = new OrbitControls(camera, canvas);
    controls.maxPolarAngle = Math.PI / 2;
    controls.enablePan = false;
    controls.minDistance = 1.5;
    controls.maxDistance = 6;
    controls.update();

    // LIGHTS
    const light = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
    light.color.setHSL(0.6, 0.3, 0.5);
    // light.groundColor.setHSL(0.5, 0.5, 0.75);
    light.position.set(0, 1, 0);
    scene.add( light );

    const lightHelper = new THREE.HemisphereLightHelper(light, 10);
    // scene.add(lightHelper);

    // GROUND
    const groundGeo = new THREE.PlaneGeometry(10000, 10000);
    const groundMat = new THREE.MeshLambertMaterial( {color: 0xffffff} );
    groundMat.color.setHSL(0.095, 1, 0.95);

    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.y = -0.63;
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add( ground );

    // MODEL
    const loader = new GLTFLoader();
    loader.load('./assets/DPX.glb', function(gltf) {
        let mesh = gltf.scene;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(gltf.scene);
        /*
        const mesh = gltf.scene.children;
        for (let i = 0; i < mesh.length; i++) {
            console.log( mesh[i] );
            scene.add( mesh[i] );
        }
        */
        // .castShadow = true;
        // mesh.receiveShadow = true;
    });  

    // RENDERER
    renderer = new THREE.WebGLRenderer( {canvas} );
    renderer.setSize(what_text.clientWidth, what_text.clientHeight, false);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true;
}

// Change view when display size changes
function resizeRendererToDisplaySize(renderer) {
    const canv = renderer.domElement;
    const width = what_text.clientWidth;
    const height = what_text.clientHeight;
    const needResize = canv.width !== width || canv.height !== height;
    if (needResize) {
        renderer.setSize(width, height, false);
    }
    return needResize;
}

// Call init before changing stuff
init();

// Request to render if controls changed
var renderRequested = false;
function requestRenderIfNotRequested() {
    if (!renderRequested) {
        renderRequested = true;
        requestAnimationFrame(render);
    }
}  
controls.addEventListener('change', requestRenderIfNotRequested);

// === RENDER ===
function render() {
    renderRequested = false;

    if (resizeRendererToDisplaySize(renderer)) {
        const canv = renderer.domElement;
        camera.aspect = canv.clientWidth / canv.clientHeight;
        camera.updateProjectionMatrix();
    }

    // const delta = clock.getDelta();
    renderer.render(scene, camera);
}

function animate() {    
	requestAnimationFrame( animate );
    render();
}

animate();
