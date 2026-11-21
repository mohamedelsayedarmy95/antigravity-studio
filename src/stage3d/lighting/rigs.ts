import * as THREE from "three";
import { resolveColor } from "../plan";
import type { LightingSpec, Palette } from "../schema";

/**
 * Studio lighting as data. Each rig is a set of emissive "lightformer" panels placed around the
 * subject; the panels are rendered once into a prefiltered (PMREM) environment map, which drives
 * reflections and image-based lighting on every physical material. Strip lights trace the razor
 * highlights on metal edges; softboxes give broad, controlled reflections on glass.
 */

interface Panel {
  size: [number, number];
  position: [number, number, number];
  /** Hex or palette role. */
  color: string;
  intensity: number;
}

const RIGS: Record<LightingSpec["rig"], Panel[]> = {
  stripRim: [
    { size: [0.5, 9], position: [-5, 1, -3], color: "#ffffff", intensity: 9 },
    { size: [0.5, 9], position: [5, 1, -3], color: "#ffffff", intensity: 9 },
    { size: [6, 6], position: [0, 7, 0.5], color: "#ffffff", intensity: 2.4 },
    { size: [4, 2.5], position: [0, 0.5, 7], color: "#ffffff", intensity: 0.35 },
    { size: [12, 0.25], position: [0, -2.5, -6], color: "palette.accent", intensity: 2.5 },
  ],
  studioSoftbox: [
    { size: [4, 4], position: [-5, 3, 4], color: "#fff6ea", intensity: 4.5 },
    { size: [7, 7], position: [0, 7, 0], color: "#ffffff", intensity: 2.8 },
    { size: [3, 4], position: [6, 1, 3], color: "#eaf2ff", intensity: 1.1 },
    { size: [0.8, 7], position: [-4, 1, -6], color: "#ffffff", intensity: 5 },
    { size: [0.8, 7], position: [4, 1, -6], color: "#ffffff", intensity: 5 },
  ],
  neonGels: [
    { size: [0.45, 9], position: [-5, 0, -2], color: "palette.primary", intensity: 10 },
    { size: [0.45, 9], position: [5, 0, -2], color: "palette.accent", intensity: 10 },
    { size: [5, 5], position: [0, 7, 0], color: "#ffffff", intensity: 1 },
    { size: [14, 0.2], position: [0, -1.5, -7], color: "palette.primary", intensity: 5 },
    { size: [3, 2], position: [0, 1, 7], color: "#ffffff", intensity: 0.25 },
  ],
};

/** Builds the PMREM environment for a rig. Caller owns (and disposes) the returned render target. */
export function buildEnvironment(renderer: THREE.WebGLRenderer, rig: LightingSpec["rig"], palette: Palette): THREE.WebGLRenderTarget {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  for (const panel of RIGS[rig]) {
    const color = panel.color.startsWith("palette.")
      ? resolveColor(panel.color as `palette.${keyof Palette}`, palette)
      : new THREE.Color(panel.color);
    const geometry = new THREE.PlaneGeometry(panel.size[0], panel.size[1]);
    const material = new THREE.MeshBasicMaterial({ color: color.multiplyScalar(panel.intensity), side: THREE.DoubleSide, toneMapped: false });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...panel.position);
    mesh.lookAt(0, 0, 0);
    scene.add(mesh);
    geometries.push(geometry);
    materials.push(material);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(scene, 0.02, 0.1, 50);
  pmrem.dispose();
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  return target;
}
