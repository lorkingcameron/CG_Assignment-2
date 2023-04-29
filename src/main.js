import * as THREE from 'three';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {MTLLoader} from 'three/addons/loaders/MTLLoader.js';
import {game} from './game.js';
import {math} from './math.js';
import {visibility} from './visibility.js';

const _NUM_BOIDS = 30;
const _BOID_SPEED = 5;
const _BOID_ACCELERATION = _BOID_SPEED / 5.0;
const _BOID_FORCE_MAX = _BOID_ACCELERATION / 10.0;
const _BOID_FORCE_ALIGNMENT = 5;
const _BOID_FORCE_SEPARATION = 8;
const _BOID_FORCE_COHESION = 4;
const _BOID_FORCE_WANDER = 5;
const _BOID_FORCE_ORIGIN = 1000;

class Boid {
  constructor(game, params) {
    this._mesh = new THREE.Mesh(
        params.geometry,
        params.material);
    this._mesh.castShadow = true;
    this._mesh.receiveShadow = false;

    this._group = new THREE.Group();
    this._group.add(this._mesh);
    this._group.position.set(
        math.rand_range(-50, 50),
        math.rand_range(-50, 50),
        math.rand_range(-50, 50));
    this._direction = new THREE.Vector3(
        math.rand_range(-1, 1),
        math.rand_range(-1, 1),
        math.rand_range(-1, 1));
    this._velocity = this._direction.clone();

    this._maxSteeringForce = params.maxSteeringForce;
    this._maxSpeed  = params.speed;
    this._acceleration = params.acceleration;

    this._radius = 1.0;
    this._mesh.rotateX(-Math.PI / 2);

    this._game = game;
    game._graphics.Scene.add(this._group);
    this._visibilityIndex = game._visibilityGrid.UpdateItem(
        this._mesh.uuid, this);

    this._wanderAngle = Math.PI;
    this._params = params;
  }

  get Position() {
    return this._group.position;
  }

  get Velocity() {
    return this._velocity;
  }

  get Direction() {
    return this._direction;
  }

  get Radius() {
    return this._radius;
  }

  Step(timeInSeconds) {
    const local = this._game._visibilityGrid.GetLocalEntities(
        this.Position, 15);

    this._ApplySteering(timeInSeconds, local);

    const frameVelocity = this._velocity.clone();
    frameVelocity.multiplyScalar(timeInSeconds);
    this._group.position.add(frameVelocity);

    const direction = this.Direction;
    const m = new THREE.Matrix4();
    m.lookAt(
        new THREE.Vector3(0, 0, 0),
        direction,
        new THREE.Vector3(0, 1, 0));
    this._group.quaternion.setFromRotationMatrix(m);

    this._visibilityIndex = this._game._visibilityGrid.UpdateItem(
        this._mesh.uuid, this, this._visibilityIndex);
  }

  CheckBounds() {
    const pos = this._group.position;
    if (pos.x > 65) {
      pos.x = -65;
    } else if (pos.x < -65) {
      pos.x = 65;
    } else if (pos.z < -35) {
      pos.z = 35;
    } else if (pos.z > 35) {
      pos.z = -35;
    }

    this._visibilityIndex = this._game._visibilityGrid.UpdateItem(
        this._mesh.uuid, this, this._visibilityIndex);
  }

  _ApplySteering(timeInSeconds, local) {
    const separationVelocity = this._ApplySeparation(local);
    const alignmentVelocity = this._ApplyAlignment(local);
    const cohesionVelocity = this._ApplyCohesion(local);
    const originVelocity = this._ApplySeek(new THREE.Vector3(0, 0, 0));
    const wanderVelocity = this._ApplyWander();

    const steeringForce = new THREE.Vector3(0, 0, 0);
    steeringForce.add(separationVelocity);
    steeringForce.add(alignmentVelocity);
    steeringForce.add(originVelocity);
    steeringForce.add(cohesionVelocity);
    steeringForce.add(wanderVelocity);

    steeringForce.multiplyScalar(this._acceleration * timeInSeconds);

    // Clamp the force applied
    if (steeringForce.length() > this._maxSteeringForce) {
      steeringForce.normalize();
      steeringForce.multiplyScalar(this._maxSteeringForce);
    }

    this._velocity.add(steeringForce);

    // Clamp velocity
    if (this._velocity.length() > this._maxSpeed) {
      this._velocity.normalize();
      this._velocity.multiplyScalar(this._maxSpeed);
    }

    this._direction = this._velocity.clone();
    this._direction.normalize();
  }

  _ApplyWander() {
    this._wanderAngle += 0.1 * math.rand_range(-2 * Math.PI, 2 * Math.PI);
    const randomPointOnCircle = new THREE.Vector3(
        Math.cos(this._wanderAngle),
        0,
        Math.sin(this._wanderAngle));
    const pointAhead = this._direction.clone();
    pointAhead.multiplyScalar(2);
    pointAhead.add(randomPointOnCircle);
    pointAhead.normalize();
    return pointAhead.multiplyScalar(_BOID_FORCE_WANDER);
  }

  _ApplySeparation(local) {
    if (local.length == 0) {
      return new THREE.Vector3(0, 0, 0);
    }

    const forceVector = new THREE.Vector3(0, 0, 0);
    for (let e of local) {
      const distanceToEntity = Math.max(
          e.Position.distanceTo(this.Position) - 1.5 * (this.Radius + e.Radius),
          0.001);
      const directionFromEntity = new THREE.Vector3().subVectors(
          this.Position, e.Position);
      const multiplier = (
          _BOID_FORCE_SEPARATION / distanceToEntity) * (this.Radius + e.Radius);
      directionFromEntity.normalize();
      forceVector.add(
          directionFromEntity.multiplyScalar(multiplier));
    }
    return forceVector;
  }

  _CalculateSeparationForce(local) {
    const forceVector = new THREE.Vector3(0, 0, 0);
    for (let e of local) {
      const distanceToEntity = Math.max(
          e.Position.distanceTo(this.Position) - (this.Radius + e.Radius),
          0.001);
      const directionFromEntity = new THREE.Vector3().subVectors(
          this.Position, e.Position);
      directionFromEntity.normalize();

      const multiplier = _BOID_FORCE_SEPARATION * (
          (this.Radius + e.Radius) / distanceToEntity);

      forceVector.add(
          directionFromEntity.multiplyScalar(multiplier));
    }
    return forceVector;
  }

  _ApplyAlignment(local) {
    const forceVector = new THREE.Vector3(0, 0, 0);

    for (let e of local) {
      const entityDirection = e.Direction;
      forceVector.add(entityDirection);
    }

    forceVector.normalize();
    forceVector.multiplyScalar(_BOID_FORCE_ALIGNMENT);

    return forceVector;
  }

  _ApplyCohesion(local) {
    const forceVector = new THREE.Vector3(0, 0, 0);

    if (local.length == 0) {
      return forceVector;
    }

    const averagePosition = new THREE.Vector3(0, 0, 0);
    for (let e of local) {
      averagePosition.add(e.Position);
    }

    averagePosition.multiplyScalar(1.0 / local.length);

    const directionToAveragePosition = averagePosition.clone().sub(
        this.Position);
    directionToAveragePosition.normalize();
    directionToAveragePosition.multiplyScalar(_BOID_FORCE_COHESION);

    return directionToAveragePosition;
  }

  _ApplySeek(destination) {
    const distance = Math.max(0,((
        this.Position.distanceTo(destination) - 50) / 500)) ** 2;
    const direction = destination.clone().sub(this.Position);
    direction.normalize();

    const forceVector = direction.multiplyScalar(
        _BOID_FORCE_ORIGIN * distance);
    return forceVector;
  }
}


class Boids extends game.Game {
  constructor() {
    super();
  }

  _OnInitialize() {
    this._entities = [];

    this._guiParams = {
      separationEnabled: true,
      cohesionEnabled: true,
      alignmentEnabled: true,
    };
    this._gui = new dat.GUI();
    this._gui.add(this._guiParams, "separationEnabled");
    this._gui.add(this._guiParams, "cohesionEnabled");
    this._gui.add(this._guiParams, "alignmentEnabled");
    this._gui.close();

    const objLoader = new OBJLoader();
    const mtlLoader = new MTLLoader();
    const geoLibrary = {};
    mtlLoader.load(
      '../models/squid.mtl',
      (mtl) => {
        mtl.preload();
        objLoader.setMaterials(mtl);
        objLoader.load(
          '../models/squid.obj',
          (object) => {
            geoLibrary.boid = object.children[0].geometry;
            geoLibrary.boidMat = object.children[0].material;
            this._CreateBoids(geoLibrary);
          }
        )
      }
    )
    
    this._CreateEntities();
    
  }

  _CreateEntities() {
    this._visibilityGrid = new visibility.VisibilityGrid(
        [new THREE.Vector3(-500, 0, -500), new THREE.Vector3(500, 0, 500)],
        [100, 100]);
    this._graphics._camera.position.set(0, 50, 0);
    this._controls.target.set(0, 0, 0);
    this._controls.update();
  }

  _CreateBoids(geoLibrary) {
    let params = {
      geometry: geoLibrary.boid,
      material: geoLibrary.boidMat,
      speedMin: 1.0,
      speedMax: 1.0,
      speed: _BOID_SPEED,
      maxSteeringForce: _BOID_FORCE_MAX,
      acceleration: _BOID_ACCELERATION,
      colour: 0x80FF80,
      guiParams: this._guiParams
    };
    for (let i = 0; i < _NUM_BOIDS * 2; i++) {
      const e = new Boid(this, params);
      this._entities.push(e);
    }
  }

  _OnStep(timeInSeconds) {
    timeInSeconds = Math.min(timeInSeconds, 1 / 10.0);

    if (this._entities.length == 0) {
      return;
    }

    for (let e of this._entities) {
      e.Step(timeInSeconds);
    }

    for (let e of this._entities) {
      // Teleport to other side if offscreen
      e.CheckBounds();
    }
  }
}

new Boids();
