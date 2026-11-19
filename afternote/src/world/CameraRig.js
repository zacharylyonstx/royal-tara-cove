// The camera rides the route's centerline behind and above Kite and does not chase
// individual leaps (bible §9.3). Cinematic moves are blended in by the Conductor through
// `setShot`, which eases the camera to an explicit position/target and back.

import * as THREE from 'three-afternote';
import { CAMERA } from '../core/Constants.js';
import { makeFrame } from './Routes.js';

const UP = new THREE.Vector3(0, 1, 0);

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.frameBack = makeFrame();
    this.frameAhead = makeFrame();
    this.lat = 0;
    this.height = 0;
    this.shot = null; // { pos, look, weight }
    this.shotWeight = 0;
    this.shotTarget = 0;
    this.shotSpeed = 1.2;
    this.reducedMotion = false;
    this.fov = CAMERA.FOV;
    this.fovTarget = CAMERA.FOV;
    this._p = new THREE.Vector3();
    this._l = new THREE.Vector3();
    this.initialized = false;
    this.breath = 0;
  }

  /** Blend toward an explicit shot. Pass null to return to the chase view. */
  setShot(shot, speed = 1.2) {
    if (shot) {
      if (!this.shot) this.shot = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
      this.shot.pos.copy(shot.pos);
      this.shot.look.copy(shot.look);
      this.shotTarget = 1;
    } else {
      this.shotTarget = 0;
    }
    this.shotSpeed = speed;
  }

  /** Jump straight to wherever the rig wants to be (after a cut). */
  snap() {
    this.initialized = false;
  }

  /**
   * @param {import('./Routes.js').Route} route
   * @param {number} beat
   * @param {{x:number,y:number}} kite  lane offsets
   * @param {number} dt
   * @param {{breath?:boolean}} flags
   */
  update(route, beat, kite, dt, flags = {}) {
    if (route) {
      const k = Math.min(1, dt * 2.2);
      const snap = !this.initialized;
      const lat = kite.x * CAMERA.LATERAL_FOLLOW;
      const hgt = kite.y * CAMERA.VERTICAL_FOLLOW;
      this.lat = snap ? lat : this.lat + (lat - this.lat) * k;
      this.height = snap ? hgt : this.height + (hgt - this.height) * k * 0.8;

      // a breath lets the view open a little
      const wide = flags.breath && !this.reducedMotion ? 1 : 0;
      this.breath += (wide - this.breath) * Math.min(1, dt * 1.2);

      const here = route.distanceAt(beat);
      const back = route.frameAtDistance(here - CAMERA.BACK - this.breath * 1.6, this.frameBack);
      this._p.copy(back.pos).addScaledVector(back.right, this.lat * 0.85 + route.cam.side).addScaledVector(UP, CAMERA.HEIGHT + this.height + this.breath * 0.7);
      const ahead = route.frameAtDistance(here + CAMERA.LOOK_AHEAD, this.frameAhead);
      this._l.copy(ahead.pos).addScaledVector(ahead.right, this.lat * 1.1 + route.cam.lookSide).addScaledVector(UP, CAMERA.LOOK_HEIGHT + this.height * 0.9);
    }

    this.shotWeight += (this.shotTarget - this.shotWeight) * Math.min(1, dt * this.shotSpeed);
    if (this.shot && this.shotWeight > 0.001) {
      const w = this.shotWeight * this.shotWeight * (3 - 2 * this.shotWeight);
      this._p.lerp(this.shot.pos, w);
      this._l.lerp(this.shot.look, w);
    }

    if (!this.initialized) {
      this.pos.copy(this._p);
      this.look.copy(this._l);
      this.initialized = true;
    } else {
      const k = Math.min(1, dt * 9);
      this.pos.lerp(this._p, k);
      this.look.lerp(this._l, k);
    }
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
    if (Math.abs(this.fov - this.fovTarget) > 0.01) {
      this.fov += (this.fovTarget - this.fov) * Math.min(1, dt * 1.5);
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
