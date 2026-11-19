// Bloom + a gentle grade. The grade keeps shadows cool and lights warm, lifts saturation as
// the world wakes, and adds a soft vignette. Tone mapping happens once, in the output pass.

import * as THREE from 'three-afternote';
import { EffectComposer } from 'three-afternote/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three-afternote/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three-afternote/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three-afternote/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three-afternote/addons/postprocessing/OutputPass.js';
import { G } from './Shared.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uAwake: { value: 0 },
    uTime: { value: 0 },
    uVignette: { value: 1 },
    uFade: { value: 0 }, // 1 = fully faded to mist
    uFadeColor: { value: new THREE.Color(0x1b1d2e) },
    uGrain: { value: 1 },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uAwake; uniform float uTime; uniform float uVignette; uniform float uFade; uniform vec3 uFadeColor; uniform float uGrain;
    varying vec2 vUv;
    float hash(vec2 p){ p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      // the unfinished world is quieter in colour; it earns saturation
      c = mix(vec3(l), c, 0.78 + 0.34 * uAwake);
      // cool shadows, warm lights
      c = mix(c * vec3(0.9, 0.95, 1.12), c * vec3(1.06, 1.0, 0.92), smoothstep(0.05, 0.9, l));
      // soft shoulder contrast
      c = c * (1.0 + 0.12 * (c - 0.25));
      vec2 q = vUv - 0.5;
      float v = smoothstep(0.95, 0.25, length(q * vec2(1.0, 1.15)));
      c *= mix(1.0, 0.55 + 0.45 * v, uVignette);
      c += (hash(vUv * 900.0 + uTime) - 0.5) * 0.012 * uGrain;
      c = mix(c, uFadeColor, uFade);
      gl_FragColor = vec4(max(c, 0.0), 1.0);
    }`,
};

export class PostFX {
  constructor(renderer, scene, camera, { enabled = true } = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.enabled = enabled;
    this.fade = 0;
    if (!enabled) return;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.5, 0.62, 1.0);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
  }

  setSize(w, h, pixelRatio) {
    if (!this.enabled) return;
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(w, h);
  }

  setFade(v, color) {
    this.fade = v;
    if (!this.enabled) return;
    this.grade.uniforms.uFade.value = v;
    if (color !== undefined) this.grade.uniforms.uFadeColor.value.set(color);
  }

  setReduced(reduced) {
    if (!this.enabled) return;
    this.grade.uniforms.uGrain.value = reduced ? 0 : 1;
    this.bloom.strength = reduced ? 0.32 : 0.5;
  }

  render() {
    if (!this.enabled) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.grade.uniforms.uAwake.value = G.uAwake.value;
    this.grade.uniforms.uTime.value = G.uTime.value;
    this.composer.render();
  }
}
