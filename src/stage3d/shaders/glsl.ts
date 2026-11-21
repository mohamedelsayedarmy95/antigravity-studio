/**
 * Shared GLSL. All identifiers are prefixed `ue_` because these chunks are injected into
 * three.js built-in shaders (via three-custom-shader-material) where unprefixed names collide.
 */

/** 3D simplex noise — Ashima Arts / Stefan Gustavson (MIT). Deterministic, no textures. */
export const NOISE_GLSL = /* glsl */ `
vec3 ue_mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 ue_mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 ue_permute(vec4 x) { return ue_mod289(((x * 34.0) + 1.0) * x); }
vec4 ue_taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float ue_snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = ue_mod289(i);
  vec4 p = ue_permute(ue_permute(ue_permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = ue_taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

/**
 * Parametric shapes sharing one (u,v) domain: u ∈ [0,1) wraps around Y, v ∈ [0,1] runs top to
 * bottom. Because every shape uses the same domain, any shape morphs into any other by blending
 * positions per (u,v) — the sphere's poles open into the torus hole, the torus winds into a knot.
 * Shape ids must match MORPH_SHAPE_IDS in TypeScript.
 */
export const SHAPES_GLSL = /* glsl */ `
#define UE_PI 3.141592653589793
#define UE_TAU 6.283185307179586

vec3 ue_sphere(vec2 uv) {
  float th = uv.x * UE_TAU;
  float ph = uv.y * UE_PI;
  return vec3(sin(ph) * cos(th), cos(ph), sin(ph) * sin(th));
}

// Icosahedron with circumradius ~1.08: ray from the centre to the nearest face plane.
float ue_icoSupport(vec3 d) {
  const float a = 0.5773502692;            // 1/sqrt(3)
  const float b = 0.3568220898;            // (1/phi)/sqrt(3)
  const float c = 0.9341723590;            // phi/sqrt(3)
  float m = 0.0;
  m = max(m, abs(dot(d, vec3( a,  a,  a))));
  m = max(m, abs(dot(d, vec3( a,  a, -a))));
  m = max(m, abs(dot(d, vec3( a, -a,  a))));
  m = max(m, abs(dot(d, vec3( a, -a, -a))));
  m = max(m, abs(dot(d, vec3(0.0,  b,  c))));
  m = max(m, abs(dot(d, vec3(0.0,  b, -c))));
  m = max(m, abs(dot(d, vec3( b,  c, 0.0))));
  m = max(m, abs(dot(d, vec3(-b,  c, 0.0))));
  m = max(m, abs(dot(d, vec3( c, 0.0,  b))));
  m = max(m, abs(dot(d, vec3( c, 0.0, -b))));
  return m;
}
vec3 ue_icosahedron(vec2 uv) {
  vec3 d = ue_sphere(uv);
  return d * (0.858 / ue_icoSupport(d));
}

// Rounded cube as a superellipsoid (exponent 7 gives softly rounded edges).
vec3 ue_roundedBox(vec2 uv) {
  vec3 d = ue_sphere(uv);
  vec3 a = abs(d);
  float p = 7.0;
  float k = pow(pow(a.x, p) + pow(a.y, p) + pow(a.z, p), 1.0 / p);
  return d / k * 0.74;
}

// Torus in the XZ plane. v=0 is the inner equator, 0.25 the top, 0.5 the outer equator.
vec3 ue_torus(vec2 uv) {
  float th = uv.x * UE_TAU;
  float a = UE_PI - uv.y * UE_TAU;
  float R = 0.68;
  float r = 0.3;
  float rr = R + r * cos(a);
  return vec3(rr * cos(th), r * sin(a), rr * sin(th));
}

// (2,3) torus knot, tube frame built like THREE.TorusKnotGeometry.
vec3 ue_knotCurve(float t) {
  float r = 2.0 + cos(3.0 * t);
  return vec3(r * cos(2.0 * t), sin(3.0 * t), r * sin(2.0 * t)) * 0.3;
}
vec3 ue_torusKnot(vec2 uv) {
  float t = uv.x * UE_TAU;
  vec3 p1 = ue_knotCurve(t);
  vec3 p2 = ue_knotCurve(t + 0.01);
  vec3 T = p2 - p1;
  vec3 N = p2 + p1;
  vec3 B = normalize(cross(T, N));
  N = normalize(cross(B, T));
  float a = UE_PI - uv.y * UE_TAU;
  return p1 + 0.16 * (cos(a) * N + sin(a) * B);
}

vec3 ue_shape(int id, vec2 uv) {
  if (id == 0) return ue_sphere(uv);
  if (id == 1) return ue_icosahedron(uv);
  if (id == 2) return ue_roundedBox(uv);
  if (id == 3) return ue_torus(uv);
  return ue_torusKnot(uv);
}
`;

/** sRGB OETF and a texture-free, sine-free hash (stable across frames on the same GPU). */
export const DISPLAY_GLSL = /* glsl */ `
vec3 ue_linearToSrgb(vec3 c) {
  c = max(c, vec3(0.0));
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
float ue_hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
`;
