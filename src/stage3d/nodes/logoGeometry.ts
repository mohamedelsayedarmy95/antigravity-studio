import { useEffect, useLayoutEffect, useState } from "react";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * SVG → extruded, bevelled mesh, normalized to width 1 and centred at the origin.
 * Results are cached per (src, depth, bevel) and shared by logo nodes and particle targets.
 */
const resolved = new Map<string, THREE.BufferGeometry>();
const pending = new Map<string, Promise<THREE.BufferGeometry>>();

const keyOf = (src: string, depth: number, bevel: number) => `${src}|${depth}|${bevel}`;

/** Mirroring Y (SVG is y-down) flips triangle winding; swap two vertices per triangle to restore it. */
function flipWinding(geometry: THREE.BufferGeometry) {
  for (const name of Object.keys(geometry.attributes)) {
    const attr = geometry.getAttribute(name) as THREE.BufferAttribute;
    const size = attr.itemSize;
    const arr = attr.array as Float32Array;
    for (let tri = 0; tri < attr.count; tri += 3) {
      for (let c = 0; c < size; c++) {
        const i1 = (tri + 1) * size + c;
        const i2 = (tri + 2) * size + c;
        const tmp = arr[i1];
        arr[i1] = arr[i2];
        arr[i2] = tmp;
      }
    }
    attr.needsUpdate = true;
  }
}

export function parseLogo(svgText: string, depth: number, bevel: number, label: string): THREE.BufferGeometry {
  const data = new SVGLoader().parse(svgText);
  const shapes = data.paths.flatMap((p) => p.toShapes());
  if (shapes.length === 0) throw new Error(`Logo "${label}" contains no filled shapes.`);

  const box = new THREE.Box2();
  for (const s of shapes) for (const pt of s.getPoints(64)) box.expandByPoint(pt);
  const width = box.max.x - box.min.x;
  if (!(width > 0)) throw new Error(`Logo "${label}" has zero width.`);

  const parts = shapes.map(
    (shape) =>
      new THREE.ExtrudeGeometry(shape, {
        depth: depth * width,
        bevelEnabled: bevel > 0,
        bevelThickness: bevel * width,
        bevelSize: bevel * width * 0.8,
        bevelSegments: 8,
        curveSegments: 64,
      }),
  );
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  if (!merged) throw new Error(`Logo "${label}": could not merge extruded shapes.`);

  merged.scale(1 / width, -1 / width, 1 / width);
  flipWinding(merged);
  merged.center();
  merged.computeBoundingSphere();
  return merged;
}

export function loadLogoGeometry(src: string, depth: number, bevel: number): Promise<THREE.BufferGeometry> {
  const key = keyOf(src, depth, bevel);
  const hit = resolved.get(key);
  if (hit) return Promise.resolve(hit);
  let p = pending.get(key);
  if (!p) {
    p = fetch(staticFile(src))
      .then((r) => {
        if (!r.ok) throw new Error(`Logo "${src}" failed to load: HTTP ${r.status}. Put the SVG under public/.`);
        return r.text();
      })
      .then((text) => {
        const g = parseLogo(text, depth, bevel, src);
        resolved.set(key, g);
        return g;
      });
    pending.set(key, p);
  }
  return p;
}

/**
 * Loads a logo geometry, holding the render (delayRender) until it exists and re-rendering the
 * canvas once it does, so no frame is ever captured without the logo.
 */
export function useLogoGeometry(src: string | null, depth: number, bevel: number): THREE.BufferGeometry | null {
  const key = src ? keyOf(src, depth, bevel) : null;
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(() => (key ? resolved.get(key) ?? null : null));
  const [handle] = useState<number | null>(() => (key && !resolved.has(key) ? delayRender(`Loading logo ${src}`) : null));
  const advance = useThree((s) => s.advance);

  useEffect(() => {
    if (!src || geometry) return;
    let alive = true;
    loadLogoGeometry(src, depth, bevel)
      .then((g) => alive && setGeometry(g))
      .catch((err: Error) => cancelRender(err));
    return () => {
      alive = false;
    };
  }, [src, depth, bevel, geometry]);

  useLayoutEffect(() => {
    if (geometry && handle !== null) {
      advance(performance.now()); // async content: re-render the canvas before the frame is captured
      continueRender(handle);
    }
  }, [geometry, handle, advance]);

  return geometry;
}
