declare module "three" {
  export class Vector2 {
    constructor(x?: number, y?: number);
    x: number;
    y: number;
  }

  export class Vector3 {
    constructor(x?: number, y?: number, z?: number);
    x: number;
    y: number;
    z: number;
    set(x: number, y: number, z: number): this;
    setScalar(value: number): this;
    clone(): Vector3;
    applyMatrix4(m: Matrix4): Vector3;
    project(camera: Camera): Vector3;
  }

  export class Color {
    constructor(color?: string | number);
    set(color: string | number): this;
  }

  export class Object3D {
    position: Vector3;
    rotation: { x: number; y: number; z: number };
    scale: Vector3;
    matrixWorld: Matrix4;
    userData: Record<string, unknown>;
    visible: boolean;
    add(...objects: Object3D[]): this;
  }

  export class Group extends Object3D {}

  export class Scene extends Object3D {
    add(...objects: Object3D[]): this;
  }

  export class Matrix4 {}

  export class Camera {
    position: Vector3;
    lookAt(x: number, y: number, z: number): void;
  }

  export class PerspectiveCamera extends Camera {
    constructor(fov?: number, aspect?: number, near?: number, far?: number);
    aspect: number;
    updateProjectionMatrix(): void;
  }

  export interface WebGLRendererParameters {
    antialias?: boolean;
    alpha?: boolean;
  }

  export class WebGLRenderer {
    constructor(parameters?: WebGLRendererParameters);
    domElement: HTMLCanvasElement;
    setPixelRatio(value: number): void;
    setSize(width: number, height: number): void;
    render(scene: Scene, camera: Camera): void;
    dispose(): void;
  }

  export class AmbientLight extends Object3D {
    constructor(color?: number | string, intensity?: number);
  }

  export class PointLight extends Object3D {
    constructor(color?: number | string, intensity?: number, distance?: number);
  }

  export class BufferGeometry {
    setFromPoints(points: Vector3[]): this;
    dispose(): void;
  }

  export class SphereGeometry extends BufferGeometry {
    constructor(radius?: number, widthSegments?: number, heightSegments?: number);
  }

  export class TorusGeometry extends BufferGeometry {
    constructor(
      radius?: number,
      tube?: number,
      radialSegments?: number,
      tubularSegments?: number,
      arc?: number,
    );
  }

  export interface MaterialParameters {
    color?: number | string;
    transparent?: boolean;
    opacity?: number;
  }

  export class Material {
    dispose(): void;
  }

  export class MeshStandardMaterial extends Material {
    constructor(parameters?: MaterialParameters & { roughness?: number; metalness?: number });
    color: Color;
    emissive: Color;
    emissiveIntensity: number;
    roughness: number;
    metalness: number;
  }

  export class LineBasicMaterial extends Material {
    constructor(parameters?: MaterialParameters);
  }

  export class Mesh extends Object3D {
    constructor(geometry?: BufferGeometry, material?: Material);
    geometry: BufferGeometry;
    material: MeshStandardMaterial;
  }

  export class LineSegments extends Object3D {
    constructor(geometry?: BufferGeometry, material?: Material);
  }

  export interface Intersection {
    object: Object3D;
    distance: number;
  }

  export class Raycaster {
    setFromCamera(coords: Vector2, camera: Camera): void;
    intersectObjects(objects: Object3D[], recursive?: boolean): Intersection[];
  }

  export class Clock {
    getElapsedTime(): number;
  }
}
