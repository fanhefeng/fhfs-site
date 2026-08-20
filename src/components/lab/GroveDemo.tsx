"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import * as THREE from "three";
import { gsap, useGSAP, ScrollTrigger } from "@/lib/gsap";
import { hasWebGL, prefersSaveData } from "@/lib/three/guards";
import { buildGrove, buildMotes, BOX_W } from "@/lib/lab/grove";

type Props = {
  accent: string;
  hint: string;
  headline: string;
  body: string;
  tail: string;
  fallbackNote: string;
  stageScan: string;
  stageGrow: string;
  stageSettle: string;
};

/* ────────────────────────────────────────────────────────────────────────
   shared GLSL
   ──────────────────────────────────────────────────────────────────────── */

/**
 * Two directional lights and a sky term, written out rather than pulled from
 * three's lighting chunks: these materials carry a moss cushion, a scan front
 * and a growth parameter that none of the built-in materials know about, so
 * they are ShaderMaterials anyway and the chunk plumbing would buy nothing.
 */
const LIGHT_GLSL = /* glsl */ `
uniform vec3 uKeyDir, uKeyCol, uFillDir, uFillCol, uAmbCol, uHazeCol;
uniform float uHaze, uFog, uHazeLift, uBoxH;
/* x: local midpoint, y: how far out the form is kept, z: how long it takes to go */
uniform vec3 uCut;

/* A swept tube is open at both ends, and a tube end inside the frame reads as
   a severed length of pipe however good the moss on it is. Running the ridge
   wide enough to clear the frustum is the obvious answer and the wrong one:
   the blades scale with it, so the far fur ends up coarser on screen than the
   near root's despite being four times further away. Dissolving the last of it
   into the haze instead keeps both — a landform that carries on into mist. */
float endFade(float lx){
  return 1.0 - smoothstep(uCut.y - uCut.z, uCut.y, abs(lx - uCut.x));
}

vec3 litSurface(vec3 N, vec3 albedo, float ao){
  float k = max(dot(N, uKeyDir), 0.0);
  float f = max(dot(N, uFillDir), 0.0);
  float sky = 0.5 + 0.5 * N.y;
  return albedo * (uKeyCol * (0.09 + 1.05 * k)
                 + uFillCol * (0.04 + 0.34 * f)
                 + uAmbCol * (0.35 + 0.65 * sky)) * ao;
}

/* Aerial perspective, weighted by the surface's own luminance. A flat mix
   toward the haze colour puts a floor under every shadow, which is what
   collapses a moss render into one flat mid-tone: the darks lift, the range
   closes, and no amount of light direction gets it back.

   uHazeLift is what re-opens that floor for the ridge in the distance — at
   that range air really does lift the darks, and holding the ridge to the near
   root's setting leaves it reading as a cut-out rather than as a landform
   several hundred metres back. */
vec3 aerial(vec3 c, float h){
  float amt = clamp(uFog + uHaze * smoothstep(0.05, 0.95, h), 0.0, 1.0);
  float gain = smoothstep(0.003, 0.075, dot(c, vec3(0.30, 0.59, 0.11)));
  return mix(c, uHazeCol, amt * mix(uHazeLift, 1.0, gain));
}
`;

/**
 * The survey pulse. A wavefront expands from one point and the root only
 * exists behind it, so the branch is drawn in as the front passes over it
 * rather than faded in as a whole. `lag` holds each material a beat behind the
 * others, and the front is wobbled by two long sines so it never reads as a
 * clean circle sweeping the screen.
 */
const SCAN_GLSL = /* glsl */ `
uniform vec3 uScanO;
uniform float uScanR;

float scanEdge(vec3 w, float lag){
  float wob = sin(w.y * 0.9 + w.x * 0.6) * 0.30 + sin(w.z * 1.7 + w.y * 1.1) * 0.14;
  return uScanR - lag + wob - distance(w, uScanO);
}
`;

/** Gradient noise — value noise puts its extrema on the lattice, which on a
    tube shows up as blobs in rows. */
const NOISE_GLSL = /* glsl */ `
vec2 hash22(vec2 p){
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}
float gnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(dot(hash22(i + vec2(0,0)), f - vec2(0,0)),
                 dot(hash22(i + vec2(1,0)), f - vec2(1,0)), u.x),
             mix(dot(hash22(i + vec2(0,1)), f - vec2(0,1)),
                 dot(hash22(i + vec2(1,1)), f - vec2(1,1)), u.x), u.y);
}
const mat2 ROT = mat2(0.80, 0.60, -0.60, 0.80);
float gfbm(vec2 p){
  float a = 0.5, s = 0.0;
  for(int i = 0; i < 5; i++){ s += a * gnoise(p); p = ROT * p * 2.03; a *= 0.5; }
  return s;
}
float ridged(vec2 p){
  float a = 0.5, s = 0.0;
  for(int i = 0; i < 4; i++){ s += a * (1.0 - abs(gnoise(p) * 2.0)); p = ROT * p * 2.11; a *= 0.5; }
  return s;
}
`;

/**
 * Wind is a function of the scroll phase, not of a clock.
 *
 * That is the whole conceit of this study — the scrollbar is the playhead —
 * but it also buys the performance budget outright: with nothing driven by
 * time, a parked scene has nothing left to update, so the renderer can stop
 * dead on its last frame instead of idling at 60fps to sway grass nobody is
 * looking at (DESIGN.md §5.3).
 */
const WIND_GLSL = /* glsl */ `
uniform float uPhase;
vec3 windOffset(vec3 p){
  float ph = p.x * 0.42 + p.y * 0.30 + p.z * 0.70;
  float a = 0.030;
  return vec3((sin(uPhase * 0.58 + ph) + 0.45 * sin(uPhase * 1.37 + ph * 2.3)) * a,
              sin(uPhase * 0.79 + ph * 1.7) * a * 0.42,
              sin(uPhase * 0.51 + ph * 0.9) * a * 0.55);
}
`;

/** ACES + sRGB done here rather than through three's chunks: the chunk names
    moved in r152 and again later, and this scene does not need any of the rest
    of the pipeline those includes drag in. */
const OUTPUT_GLSL = /* glsl */ `
vec3 acesFilm(vec3 x){
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
vec4 finish(vec3 lit, float alpha){
  return vec4(pow(acesFilm(lit * 1.30), vec3(1.0 / 2.2)), alpha);
}
`;

/* ────────────────────────────────────────────────────────────────────────
   bark + cushion
   ──────────────────────────────────────────────────────────────────────── */

const BARK_VERT = /* glsl */ `
attribute vec3 aInfo;
uniform float uBoxH;
varying vec3 vN, vW, vInfo;
varying float vH, vLx;
${WIND_GLSL}
void main(){
  vInfo = aInfo;
  vN = normalize(normal);
  vec3 p = position + windOffset(position) * (0.35 + 0.65 * aInfo.z);
  vLx = p.x;
  vH = clamp(p.y / uBoxH + 0.5, 0.0, 1.0);
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const BARK_FRAG = /* glsl */ `
precision highp float;
varying vec3 vN, vW, vInfo;
varying float vH, vLx;
${NOISE_GLSL}
${LIGHT_GLSL}
${SCAN_GLSL}
${OUTPUT_GLSL}

/* Bark grain is strongly anisotropic — features run about ten times longer
   along the limb than around it, so the domain is squashed in v first. */
vec2 barkDomain(vec2 uv){ return vec2(uv.x * 7.0, uv.y * 0.62); }

float barkHeight(vec2 uv){
  vec2 q = barkDomain(uv);
  vec2 w = vec2(gfbm(q * 0.5), gfbm(q * 0.5 + 9.1));
  vec2 p = q + w * 0.60;                 // meander the fissures
  float ridge = ridged(p);
  float plate = smoothstep(-0.25, 0.45, gfbm(q * 0.34));
  float crack = smoothstep(0.30, 0.86, ridged(p * 1.9 + 4.0));
  float fine  = gfbm(p * 5.5) * 0.5 + 0.5;
  return (ridge - 0.5) * 1.85 * mix(0.35, 1.0, plate) - crack * 0.42 + fine * 0.20;
}

/* Bump-map a surface that has no usable parameterisation, from screen-space
   derivatives of the height field. */
vec3 bumped(vec3 N, vec3 p, float h, float k){
  vec3 dpx = dFdx(p), dpy = dFdy(p);
  float dhx = dFdx(h) * k, dhy = dFdy(h) * k;
  vec3 r1 = cross(dpy, N), r2 = cross(N, dpx);
  float det = dot(dpx, r1);
  vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
  return normalize(abs(det) * N - grad);
}

void main(){
  /* The solid lags the cage: the wireframe is drawn at the front itself and
     the shell a beat behind it, which is what makes the pass read as a survey
     of the branch rather than as a wipe uncovering a picture of one. */
  float edge = scanEdge(vW, 0.55);
  if (edge < 0.0) discard;
  float fade = endFade(vLx);
  if (fade < 0.004) discard;

  vec2 uv = vInfo.xy;
  float cap = vInfo.z;
  float m = smoothstep(0.05, 0.42, cap);
  vec3 N = normalize(vN);

  float h = barkHeight(uv);
  N = bumped(N, vW, h, mix(0.26, 0.06, m));

  vec2 q = barkDomain(uv);
  float grain  = gfbm(q * 1.25) * 0.5 + 0.5;
  float mottle = gfbm(q * 0.28 + 21.0) * 0.5 + 0.5;
  float crack  = smoothstep(0.30, 0.86, ridged(q * 1.9 + 4.0));

  /* Old wet-forest wood: silvered grey where the light rakes it, near-black
     in the splits, drifting slowly into a damp umber. */
  vec3 silver = mix(vec3(0.020, 0.019, 0.018), vec3(0.290, 0.283, 0.264), grain);
  vec3 umber  = mix(vec3(0.024, 0.019, 0.016), vec3(0.175, 0.140, 0.110), grain);
  vec3 wood   = mix(silver, umber, mottle * 0.78);
  wood *= 1.0 - 0.70 * crack;

  float mo = gfbm(vec2(vW.x * 2.6, vW.z * 2.6 + vW.y * 1.9)) * 0.5 + 0.5;
  vec3 moss = mix(vec3(0.0204, 0.0311, 0.0050), vec3(0.0914, 0.1392, 0.0227), mo);
  moss *= 0.80 + 0.42 * cap;

  vec3 col = mix(wood, moss, m);

  /* A pale lichen crust where bare wood faces up. */
  float lich = smoothstep(0.56, 0.84, gfbm(q * 0.62 + 31.0) * 0.5 + 0.5);
  lich *= (1.0 - m) * smoothstep(-0.10, 0.70, N.y) * smoothstep(0.15, 0.50, h);
  col = mix(col, vec3(0.162, 0.176, 0.132), lich * 0.78);

  /* Contact shadow along the moss line. The cushion overhangs the bark it
     sits on; without this the two materials meet on a clean edge that reads
     as a paint mask rather than as one thing growing on another. */
  float contact = smoothstep(0.0, 0.16, cap) * (1.0 - smoothstep(0.16, 0.60, cap));
  col *= 1.0 - 0.48 * contact;

  float ao = mix(0.30, 1.02, smoothstep(-0.40, 0.62, h)) * mix(1.0, 0.86, m);
  vec3 lit = litSurface(N, col, ao);

  vec3 V = normalize(cameraPosition - vW);
  lit += col * uAmbCol * pow(1.0 - max(dot(N, V), 0.0), 4.0) * 0.85;
  lit += uKeyCol * pow(max(dot(reflect(-uKeyDir, N), V), 0.0), 20.0) * 0.045 * (1.0 - m) * ao;

  /* The front itself glows, so the scan reads as something passing over the
     form rather than as the form simply appearing. The falloff is in world
     units and the whole root is only about twelve of them across — at the
     first-guess rate this band was a couple of pixels wide and may as well not
     have been there. */
  lit += vec3(0.30, 0.72, 0.46) * exp(-edge * 1.6) * 0.75;

  gl_FragColor = finish(aerial(lit, vH), fade);
}
`;

/* ────────────────────────────────────────────────────────────────────────
   the fur
   ──────────────────────────────────────────────────────────────────────── */

const GRASS_VERT = /* glsl */ `
attribute vec3 aOffset;
attribute vec3 aNormal;
attribute vec4 aRandom;   // yaw, length, lean, tone
attribute float aClump;
uniform float uGrow, uBoxH, uMouseR;
uniform vec3 uMouse;
varying float vT, vShade, vTone, vH, vPart, vLx;
varying vec3 vN, vW;
${WIND_GLSL}

void main(){
  float t = uv.y; vT = t;
  /* Blades grow out of the cushion rather than fading in: a fade leaves the
     full silhouette standing there at low alpha from the first frame, which
     gives the whole trick away before the scan has even arrived. */
  float len = aRandom.y * uGrow;

  vec3 ref = abs(aNormal.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 T0 = normalize(cross(aNormal, ref));
  vec3 B0 = cross(aNormal, T0);
  float ca = cos(aRandom.x), sa = sin(aRandom.x);
  vec3 widthDir = T0 * ca + B0 * sa;
  vec3 leanDir  = T0 * -sa + B0 * ca;

  float bend = t * t;
  float gust = (sin(uPhase * 1.75 + aOffset.x * 1.6 + aRandom.x) * 0.12
             +  sin(uPhase * 0.85 + aOffset.x * 0.55) * 0.07);

  vec3 world = aOffset + windOffset(aOffset)
             + aNormal * (t * len)
             + widthDir * (position.x * len * 0.62)
             + leanDir * (aRandom.z * 0.42 * len) * bend
             + (T0 * gust + B0 * gust * 0.6) * bend * len * 1.6;

  /* The pointer parts the fur: push tangentially, press down along the normal.
     Scaled by the blade's own length rather than by a constant — a fixed push
     is several times the height of a moss blade and combs the pile into
     streaks instead of parting it. */
  vec3 toB = aOffset - uMouse;
  float infl = smoothstep(uMouseR, 0.0, length(toB * vec3(1.0, 1.0, 0.30)));
  infl *= infl;
  vec3 push = toB - aNormal * dot(toB, aNormal);
  float pl = length(push);
  push = pl > 0.0001 ? push / pl : T0;
  world += push * infl * bend * len * 2.2;
  world -= aNormal * infl * bend * len * 1.0;
  vPart = infl;

  vShade = (0.66 + 0.34 * aRandom.w) * (0.82 + 0.18 * sin(aRandom.x * 2.0));
  vShade *= 0.46 + 0.54 * clamp(aNormal.y * 0.5 + 0.62, 0.0, 1.0);
  vTone = smoothstep(0.16, 0.86, aClump);
  vN = normalize(mix(aNormal, normalize(leanDir * aRandom.z + aNormal), 0.35));
  vLx = world.x;
  vH = clamp(world.y / uBoxH + 0.5, 0.0, 1.0);
  vec4 wp = modelMatrix * vec4(world, 1.0);
  vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const GRASS_FRAG = /* glsl */ `
precision highp float;
varying float vT, vShade, vTone, vH, vPart, vLx;
varying vec3 vN, vW;
${LIGHT_GLSL}
${SCAN_GLSL}
${OUTPUT_GLSL}

void main(){
  if (scanEdge(vW, 0.55) < 0.0) discard;
  float fade = endFade(vLx);
  if (fade < 0.004) discard;

  /* Linear-space colours. The channel ratios are solved backwards from a
     photographic reference rather than picked: real moss sits around hue 77°,
     saturation 56%, value 23% — a good deal more yellow, and a good deal
     deeper, than the green a shader reaches for unaided. */
  vec3 deep  = vec3(0.0126, 0.0192, 0.0031);
  vec3 mid   = vec3(0.0488, 0.0744, 0.0121);
  vec3 tip   = vec3(0.1222, 0.1860, 0.0304);
  vec3 tipHi = vec3(0.2600, 0.3900, 0.0640);

  vec3 col = mix(deep, mid, smoothstep(0.0, 0.62, vT));
  col = mix(col, tip, smoothstep(0.38, 1.0, vT) * (0.35 + 0.65 * vTone));
  col *= 0.62 + 0.72 * vTone;
  col *= vShade;
  /* parted fur shows the shaded pile underneath it */
  col *= 1.0 - vPart * 0.55;

  vec3 N = normalize(vN);
  /* Self-shadowing inside the pile: the further down a blade you look, the
     less sky reaches it. Without this the fur reads as astroturf however good
     the colours are. */
  vec3 lit = litSurface(N, col, mix(0.40, 1.10, smoothstep(0.0, 0.88, vT)) * (0.70 + 0.52 * vTone));

  /* The sunlit crown is added AFTER the pile shading. Folded into the albedo
     instead, it comes back out at the same value as everything else — which
     is exactly the flat mid-tone the render is trying to escape. Only the
     last quarter of a blade is in the open, and it carries the whole top
     decile of the histogram. */
  lit += tipHi * smoothstep(0.68, 1.0, vT) * vTone
       * (0.30 + 0.70 * max(dot(N, uKeyDir), 0.0)) * 0.95;

  vec3 V = normalize(cameraPosition - vW);
  lit += col * uKeyCol * pow(max(dot(V, -uKeyDir), 0.0), 2.2) * 0.55 * vT;

  gl_FragColor = finish(aerial(lit, vH), fade);
}
`;

/* ────────────────────────────────────────────────────────────────────────
   ferns
   ──────────────────────────────────────────────────────────────────────── */

const FERN_VERT = /* glsl */ `
attribute vec3 aOffset;
attribute vec4 aQuat;
attribute vec2 aRandom;   // size, tint
uniform float uGrow, uBoxH;
varying vec2 vUv;
varying vec3 vN, vW;
varying float vH, vTint, vLx;
${WIND_GLSL}

vec3 qrot(vec4 q, vec3 v){ return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }

void main(){
  vUv = uv; vTint = aRandom.y;
  /* Fronds unfurl on the same parameter the moss grows on, a beat later:
     ferns colonising a cushion that is already there is the order the study
     is claiming, and popping them in at full size gives that away. */
  float grow = smoothstep(0.25, 1.0, uGrow);
  vec3 local = qrot(aQuat, position * aRandom.x * grow);
  vN = normalize(qrot(aQuat, normal));
  /* The frond bows from its stipe, so the sway has to climb with the vertex's
     own height up the rachis rather than move the whole instance. */
  float sway = sin(uPhase * 1.15 + aRandom.y * 6.28) * 0.055;
  local += vec3(sway, 0.0, sway * 0.45) * clamp(position.y, 0.0, 1.2) * aRandom.x;
  vec3 p = aOffset + windOffset(aOffset) + local;
  vLx = p.x;
  vH = clamp(p.y / uBoxH + 0.5, 0.0, 1.0);
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FERN_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec3 vN, vW;
varying float vH, vTint, vLx;
${LIGHT_GLSL}
${SCAN_GLSL}
${OUTPUT_GLSL}
void main(){
  if (scanEdge(vW, 0.55) < 0.0) discard;
  float fade = endFade(vLx);
  if (fade < 0.004) discard;
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vW);
  vec3 base = mix(vec3(0.0270, 0.0450, 0.0099), vec3(0.0690, 0.1150, 0.0253), vTint);
  base *= 0.80 + 0.30 * smoothstep(0.0, 0.8, vUv.x);
  vec3 lit = litSurface(N, base, 0.9);
  /* fronds are thin — light comes through them */
  lit += base * uKeyCol * pow(max(dot(V, -uKeyDir), 0.0), 2.0) * 1.05;
  gl_FragColor = finish(aerial(lit, vH), fade);
}
`;

/* ────────────────────────────────────────────────────────────────────────
   flowers
   ──────────────────────────────────────────────────────────────────────── */

const FLOWER_VERT = /* glsl */ `
attribute vec3 aOffset;
attribute vec2 aRandom;   // size, seed
uniform float uBloom, uBoxH;
varying vec2 vUv;
varying float vH, vLx;
varying vec3 vW;
${WIND_GLSL}
void main(){
  vUv = uv;
  vec3 p = aOffset + windOffset(aOffset) * 1.6;
  p += vec3(sin(uPhase * 1.5 + aRandom.y * 6.28), 0.0, 0.0) * 0.020;
  vLx = p.x;
  vH = clamp(p.y / uBoxH + 0.5, 0.0, 1.0);
  vW = (modelMatrix * vec4(p, 1.0)).xyz;

  /* Billboard in view space so the spray always faces the lens. The offset
     has to be scaled out of the group's own transform first, because the
     modelView matrix has already been applied to the anchor point. */
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float ws = length(modelMatrix[0].xyz);
  /* Each spray opens on its own beat, spread across the bloom window by its
     seed — all of them popping on the same frame reads as a switch. */
  float open = smoothstep(aRandom.y * 0.55, aRandom.y * 0.55 + 0.45, uBloom);
  mv.xy += position.xy * aRandom.x * ws * open;
  gl_Position = projectionMatrix * mv;
}
`;

const FLOWER_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uMap;
varying vec2 vUv;
varying float vH, vLx;
varying vec3 vW;
${LIGHT_GLSL}
${SCAN_GLSL}
${OUTPUT_GLSL}
void main(){
  if (scanEdge(vW, 0.55) < 0.0) discard;
  vec4 t = texture2D(uMap, vUv);
  if (t.a < 0.14) discard;
  float fade = endFade(vLx);
  /* The map is painted in sRGB and everything downstream is linear; squaring
     is the cheap approximation of the transfer, and at this size the exact
     curve is unresolvable anyway. */
  vec3 col = t.rgb * t.rgb * (uKeyCol * 0.62 + uAmbCol * 0.9);
  gl_FragColor = finish(aerial(col, vH), t.a * fade);
}
`;

/* ────────────────────────────────────────────────────────────────────────
   the survey cage
   ──────────────────────────────────────────────────────────────────────── */

/**
 * Ring-and-spar lines lifted straight off the shell grid, drawn with depth
 * testing off so the whole cage shows through itself — which is what makes it
 * read as a scan of the branch rather than as an outline drawn on one.
 */
const WIRE_VERT = /* glsl */ `
varying vec3 vW;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const WIRE_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uScanO;
uniform float uScanR, uWire, uPhase;
varying vec3 vW;
void main(){
  float d = distance(vW, uScanO);
  /* A bright ring exactly on the wavefront, over a dim cage that lingers
     behind it and then burns off with uWire. Both falloffs are in world units,
     and the whole root is only about twelve of those across. */
  float rim   = exp(-pow((d - uScanR) / 0.42, 2.0));
  float trail = smoothstep(uScanR, uScanR - 7.5, d);
  float a = (rim * 1.60 + trail * 0.30) * uWire;
  if (a < 0.004) discard;
  /* survey ticks running out along the beam */
  a *= 0.66 + 0.34 * sin(d * 5.2 - uPhase * 3.0);
  vec3 col = mix(vec3(0.30, 0.72, 0.46), vec3(0.86, 1.00, 0.90), rim);
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
}
`;

/* ────────────────────────────────────────────────────────────────────────
   drifting pollen
   ──────────────────────────────────────────────────────────────────────── */

const MOTE_VERT = /* glsl */ `
attribute vec4 aSeed;     // phase, speed, sway, size
uniform float uPhase, uSize, uScale, uClimb;
varying float vFade;
void main(){
  float ph = aSeed.x, sp = aSeed.y, am = aSeed.z;
  vec3 p = position;
  p.x += sin(uPhase * sp * 0.35 + ph) * 0.42 * am;
  /* one long rise, wrapped — the band fade hides the wrap.
     The obvious name for this half-band is a reserved word in GLSL ES. */
  float band = uClimb * 0.5;
  float climb = mod(uPhase * 0.42 * sp + ph * 0.7, uClimb) - band;
  p.y += climb;
  p.z += cos(uPhase * sp * 0.28 + ph) * 0.30 * am;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * aSeed.w * (uScale / max(-mv.z, 0.001));
  float edge = 1.0 - abs(climb) / band;
  float twinkle = 0.55 + 0.45 * sin(uPhase * (0.7 + sp * 1.6) + ph * 3.1);
  vFade = clamp(edge * 3.0, 0.0, 1.0) * twinkle;
  gl_Position = projectionMatrix * mv;
}
`;

const MOTE_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uMap;
varying float vFade;
void main(){
  vec4 t = texture2D(uMap, gl_PointCoord);
  gl_FragColor = vec4(t.rgb, t.a * vFade * 0.52);
}
`;

/**
 * The trail the pointer lifts off the moss.
 *
 * Each grain carries its own origin, velocity and birth stamp, so the CPU only
 * writes when one is respawned out of the ring — the flight itself is
 * integrated here, the same way the ambient pollen is. Which also means the
 * whole emitter costs one uniform write per frame however many grains are up.
 */
const SPRAY_VERT = /* glsl */ `
attribute vec3 aVel;
attribute float aBirth;
attribute vec2 aRnd;
uniform float uNow, uSize, uScale, uLife;
varying float vA;
void main(){
  float age = uNow - aBirth;
  if (age < 0.0 || age > uLife) {
    vA = 0.0;
    gl_PointSize = 0.0;
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);   // off the clip volume entirely
    return;
  }
  float u = age / uLife;
  /* drag on the launch velocity, a slow lift, and a little wander */
  vec3 p = position + aVel * age * (1.0 - 0.34 * u)
         + vec3(sin(aRnd.y * 6.28 + age * 2.6) * 0.115 * u, 0.245 * age, 0.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * aRnd.x * (uScale / max(-mv.z, 0.001)) * (0.45 + 0.55 * (1.0 - u));
  vA = smoothstep(0.0, 0.09, u) * (1.0 - smoothstep(0.40, 1.0, u));
  gl_Position = projectionMatrix * mv;
}
`;

const SPRAY_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uMap;
varying float vA;
void main(){
  vec4 t = texture2D(uMap, gl_PointCoord);
  gl_FragColor = vec4(t.rgb, t.a * vA * 0.85);
}
`;

/* ────────────────────────────────────────────────────────────────────────
   butterfly
   ──────────────────────────────────────────────────────────────────────── */

const WING_VERT = /* glsl */ `
uniform float uBend;
varying vec2 vUv;
varying vec3 vN, vW;
void main(){
  vUv = uv;
  /* The tip lags the stroke. A rigid plate rotating as one piece reads as
     folded paper rather than as something with a membrane, and the stroke
     itself is on the mesh's own rotation — the lag is all this has to add. */
  vec3 p = position;
  float s = uv.x;
  p.y += uBend * s * s;
  p.z += uBend * s * s * (uv.y - 0.45) * 0.35;
  vN = normalize(normalMatrix * normal);
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const WING_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uKeyDir, uKeyCol, uAmbCol;
uniform float uHind;
uniform sampler2D uTex;
varying vec2 vUv;
varying vec3 vN, vW;
${OUTPUT_GLSL}
void main(){
  float s = vUv.x, u = vUv.y;
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vW);

  /* Structural colour, not pigment: the hue swings with viewing angle — hot
     chartreuse square on, deep green at a glance. That swing is what reads as
     diffraction rather than as paint.

     Kept well under 1, and lower again than the study this came from. That
     one framed the animal at a few dozen pixels, where a clipped wing still
     reads as a wing; here the camera ends up close enough that the whole
     pattern is on show, and at the brighter albedo the border, the veins and
     the lunules all clip to the same flat chartreuse — a bow tie rather than
     a butterfly. Leaving ACES the headroom is what lets them arrive. */
  float facing = abs(dot(N, V));
  vec3 face = vec3(0.150, 0.255, 0.019);
  vec3 edge = vec3(0.028, 0.086, 0.006);
  vec3 wing = mix(edge, face, pow(facing, 0.65));
  wing *= 0.62 + 0.72 * smoothstep(0.02, 0.46, s) * (1.0 - 0.34 * smoothstep(0.45, 1.0, u));

  /* scales lie in overlapping rows running out from the base */
  vec4 tx = texture2D(uTex, vUv);
  float rows = tx.r, grain = tx.g, mottle = tx.b, shim = tx.a;
  wing *= 0.78 + 0.44 * mottle;
  wing = mix(wing * vec3(0.46, 1.14, 0.30), wing * vec3(1.34, 1.06, 0.16), shim);

  vec3 dark  = vec3(0.030, 0.026, 0.014);
  vec3 cream = vec3(0.520, 0.500, 0.290);
  vec3 amber = vec3(0.400, 0.270, 0.045);

  /* the wide sooty border down the whole distal edge */
  float border = max(smoothstep(0.60, 0.74, s), smoothstep(0.78, 0.94, u));
  vec3 c = mix(wing, dark, border);

  /* veins: pale tan over the wing, lost inside the border */
  float vp = pow(u, 0.72) * 5.2 + s * 0.55 + (mottle - 0.5) * 0.22;
  float vk = abs(fract(vp) - 0.5) * 2.0;
  float aa = fwidth(vp) * 2.0 + 0.045;
  float vw = 0.050 * (1.0 - 0.42 * s);
  float vein = 1.0 - smoothstep(vw, vw + aa, vk);
  c = mix(c, vec3(0.430, 0.400, 0.180), vein * 0.26 * (1.0 - border * 0.85));

  /* lunules set into the border: cream on the forewing, amber behind */
  float lunBand = exp(-pow((border - 0.58) / 0.20, 2.0));
  float edgeT = u * 0.62 + s * 0.58;
  float lun = exp(-pow((fract(edgeT * 7.0) - 0.5) * 4.2, 2.0));
  c = mix(c, mix(cream, amber, uHind), border * lunBand * lun * 0.90);

  /* the big apical blazes, forewing only */
  float ap1 = exp(-pow((s - 0.86) / 0.085, 2.0)) * exp(-pow((u - 0.15) / 0.100, 2.0));
  float ap2 = exp(-pow((s - 0.66) / 0.070, 2.0)) * exp(-pow((u - 0.07) / 0.075, 2.0));
  c = mix(c, cream, (1.0 - uHind) * clamp(ap1 + ap2 * 0.75, 0.0, 1.0) * 0.42);

  c *= 0.88 + 0.25 * rows;
  c *= 0.935 + 0.13 * grain;

  /* the very edge is a fringe of loose scales, paler and duller */
  float rim = clamp(smoothstep(0.93, 1.0, s) + smoothstep(0.955, 1.0, u), 0.0, 1.0);
  c = mix(c, vec3(0.230, 0.215, 0.150), rim * 0.55);

  float wrap = dot(N, uKeyDir) * 0.5 + 0.5;
  vec3 lit = c * (uKeyCol * (0.34 + 1.05 * wrap) + uAmbCol * (0.5 + 0.5 * N.y) * 1.5);
  /* light burning through the membrane from behind */
  lit += mix(vec3(0.86, 0.78, 0.20), vec3(0.34, 0.60, 0.12), border)
       * pow(max(dot(V, -uKeyDir), 0.0), 2.4) * 0.42;
  lit += vec3(0.86, 0.96, 0.52)
       * pow(max(dot(reflect(-uKeyDir, N), V), 0.0), 26.0) * 0.34 * (1.0 - border);

  gl_FragColor = finish(lit, 1.0);
}
`;

const BODY_VERT = /* glsl */ `
varying vec3 vN, vW, vP;
void main(){
  vN = normalize(normalMatrix * normal);
  vP = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const BODY_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uKeyDir, uKeyCol, uAmbCol;
varying vec3 vN, vW, vP;
${NOISE_GLSL}
${OUTPUT_GLSL}
void main(){
  vec3 N = normalize(vN);
  /* the thorax is furred, the abdomen banded */
  float band = 0.5 + 0.5 * sin(vP.z * 150.0);
  float furry = smoothstep(-0.02, 0.10, vP.z);
  vec3 base = mix(vec3(0.020, 0.019, 0.011), vec3(0.070, 0.064, 0.030), band * (1.0 - furry * 0.5));
  float fleck = smoothstep(0.86, 0.99, sin(vP.z * 120.0) * sin(atan(vP.y, vP.x) * 7.0) * 0.5 + 0.5);
  base = mix(base, vec3(0.46, 0.44, 0.24), fleck * 0.75);
  float fur = gfbm(vec2(atan(vP.y, vP.x) * 9.0, vP.z * 70.0)) * 0.5 + 0.5;
  base *= mix(1.0, 0.62 + 0.85 * fur, furry);
  float d = max(dot(N, uKeyDir), 0.0);
  vec3 col = base * (uKeyCol * (0.24 + 1.35 * d) + uAmbCol * (0.5 + 0.5 * N.y) * 1.8);
  vec3 V = normalize(cameraPosition - vW);
  col += uKeyCol * pow(max(dot(reflect(-uKeyDir, N), V), 0.0), 22.0) * 0.05;
  gl_FragColor = finish(col, 1.0);
}
`;

/* ────────────────────────────────────────────────────────────────────────
   baked plates
   ──────────────────────────────────────────────────────────────────────── */

/**
 * A spray, not a bloom. One five-petal flower at this size renders as a little
 * asterisk; what reads as white-flowered moss is a cluster of florets, so the
 * plate carries the whole cluster and each instance draws one spray.
 */
function flowerTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const florets: [number, number, number][] = [
    [32, 22, 7.4], [22, 33, 6.0], [42, 33, 6.2], [27, 44, 5.0],
    [39, 45, 5.4], [32, 33, 4.4], [46, 22, 4.2], [18, 22, 4.0],
  ];
  florets.forEach(([cx, cy, r], i) => {
    g.save();
    g.translate(cx, cy);
    g.rotate(i * 1.31);
    for (let p = 0; p < 5; p++) {
      g.save();
      g.rotate((p / 5) * Math.PI * 2);
      g.fillStyle = `rgba(255,255,251,${0.72 + 0.28 * (r / 7.4)})`;
      g.beginPath();
      g.ellipse(0, -r * 0.55, r * 0.34, r * 0.55, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    g.fillStyle = "#f0e7bd";
    g.beginPath();
    g.arc(0, 0, r * 0.24, 0, Math.PI * 2);
    g.fill();
    g.restore();
  });
  const t = new THREE.CanvasTexture(c);
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  return t;
}

/** A soft radial sprite, for the light pool and the contact shadow. */
function radialTexture(size: number, stops: [number, string][]): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [at, col] of stops) grad.addColorStop(at, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.minFilter = THREE.LinearFilter;
  return t;
}

/**
 * The wing pattern, baked once.
 *
 * It is a pure function of (span, chord), so evaluating a dozen noise octaves
 * per fragment per frame was paying over and over for a constant.
 * R rows, G grain, B mottle, A shimmer.
 */
function wingTexture(): THREE.CanvasTexture {
  const N = 128;
  const cv = document.createElement("canvas");
  cv.width = cv.height = N;
  const ctx = cv.getContext("2d")!;
  const img = ctx.createImageData(N, N);
  const d = img.data;

  const h2 = (x: number, y: number): [number, number] => {
    const a = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    const b = Math.sin(x * 269.5 + y * 183.3) * 43758.5453123;
    return [(a - Math.floor(a)) * 2 - 1, (b - Math.floor(b)) * 2 - 1];
  };
  const gn = (x: number, y: number) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const g00 = h2(ix, iy);
    const g10 = h2(ix + 1, iy);
    const g01 = h2(ix, iy + 1);
    const g11 = h2(ix + 1, iy + 1);
    const a = g00[0] * fx + g00[1] * fy;
    const b = g10[0] * (fx - 1) + g10[1] * fy;
    const c = g01[0] * fx + g01[1] * (fy - 1);
    const e = g11[0] * (fx - 1) + g11[1] * (fy - 1);
    const top = a + (b - a) * ux;
    return top + (c + (e - c) * ux - top) * uy;
  };
  const fb = (x: number, y: number, oct: number) => {
    let sum = 0;
    let amp = 0.5;
    let px = x;
    let py = y;
    for (let i = 0; i < oct; i++) {
      sum += amp * gn(px, py);
      const nx = 0.8 * px + 0.6 * py;
      const ny = -0.6 * px + 0.8 * py;
      px = nx * 2.03;
      py = ny * 2.03;
      amp *= 0.5;
    }
    return sum;
  };
  const b255 = (v: number) => Math.max(0, Math.min(255, Math.round((v * 0.5 + 0.5) * 255)));

  for (let yi = 0; yi < N; yi++) {
    const u = yi / (N - 1);
    for (let xi = 0; xi < N; xi++) {
      const sp = xi / (N - 1);
      const o = (yi * N + xi) * 4;
      d[o] = b255(fb(u * 70, sp * 16, 4));
      d[o + 1] = b255(gn(u * 165, sp * 52));
      d[o + 2] = b255(fb(sp * 4.5, u * 3, 3));
      d[o + 3] = b255(fb(sp * 6.5 + 4, u * 4.5, 3));
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.flipY = false;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/* ────────────────────────────────────────────────────────────────────────
   modelled parts
   ──────────────────────────────────────────────────────────────────────── */

/**
 * A wing modelled to its own outline rather than alpha-cut out of a rectangle.
 *
 * At this size the alpha route is the worse trade twice over: a cut-out needs a
 * texture (or a per-fragment shape function) for something that is a fixed
 * silhouette, and it puts a transparent quad into the depth sort right where
 * the moss is densest. A few hundred triangles of real outline sort correctly
 * and cost nothing.
 *
 * The wing lies in the XZ plane with its root at the origin: span runs along X,
 * chord along -Z, camber lifts into Y, and the stroke is the mesh's own
 * rotation about Z.
 */
function wingGeometry(hind: boolean): THREE.BufferGeometry {
  const NS = 30;
  const NU = 10;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];

  for (let i = 0; i < NS; i++) {
    const sp = i / (NS - 1);
    const span = hind ? 0.78 : 0.95;
    const lead = hind ? -0.06 - 0.26 * sp : 0.1 + 0.32 * sp - 0.14 * sp * sp;
    let chord = hind
      ? (0.54 + 0.48 * sp) * Math.pow(Math.max(0, 1 - Math.pow(sp, 2.2)), 0.55) *
        (1 + 0.035 * Math.cos(sp * 22))
      : (0.56 + 0.46 * sp) * Math.pow(Math.max(0, 1 - Math.pow(sp, 2.6)), 0.55);
    // Both pairs hinge on the thorax, so both roots have to be short — give
    // them their full chord and the wing floats beside the body instead of
    // growing out of it.
    chord *= 0.26 + 0.74 * (sp < 0.32 ? (sp / 0.32) * (sp / 0.32) * (3 - 2 * (sp / 0.32)) : 1);
    chord = Math.max(chord, 0.014);

    for (let j = 0; j < NU; j++) {
      const u = j / (NU - 1);
      const cam = 0.03 * Math.sin(Math.PI * u) * (1 - 0.35 * sp);
      pos.push(0.018 + sp * span, cam, lead - chord * u);
      uv.push(sp, u);
    }
  }

  for (let i = 0; i < NS - 1; i++) {
    for (let j = 0; j < NU - 1; j++) {
      const a = i * NU + j;
      const b = a + NU;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Thorax and abdomen as one swept body, swollen at the shoulders. */
function bodyGeometry(): THREE.BufferGeometry {
  const N = 30;
  const R = 9;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= N; i++) {
    const a = i / N;
    let r = 0.014 + 0.026 * Math.sin(Math.PI * Math.pow(a, 0.8));
    r += 0.02 * Math.exp(-Math.pow((a - 0.7) / 0.14, 2));
    r += 0.013 * Math.exp(-Math.pow((a - 0.97) / 0.05, 2));
    const z = -0.55 + a * 0.72;
    for (let j = 0; j <= R; j++) {
      const th = (j / R) * Math.PI * 2;
      pos.push(Math.cos(th) * r, Math.sin(th) * r * 0.9, z);
    }
  }
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < R; j++) {
      const q = i * (R + 1) + j;
      const w = q + R + 1;
      idx.push(q, w, q + 1, w, w + 1, q + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ────────────────────────────────────────────────────────────────────────
   component
   ──────────────────────────────────────────────────────────────────────── */

/** Blade counts. The shell is only ~20k vertices, so this is the build cost. */
const BLADES_NEAR_WIDE = 175_000;
const BLADES_NEAR_SMALL = 46_000;
const BLADES_FAR_WIDE = 55_000;
const BLADES_FAR_SMALL = 13_000;

/**
 * The ridge behind.
 *
 * A swept tube is open at both ends, and at any size that leaves those ends
 * inside the frame the ridge reads as a severed length of pipe lying in the
 * middle distance. So its scale is not a constant: it is solved from the
 * camera's own frustum at the depth it sits at, which is the only way both
 * ends stay outside the picture on a phone in portrait *and* on an ultrawide.
 */
const FAR_DEPTH = 34;
const FAR_SCALE = 6.5;
/** Local x of the ridge's midpoint, and the local y its crest reaches. */
const FAR_MID_X = -0.35;
const FAR_TOP = 1.36;

/**
 * A scroll-driven landscape: nothing here is on a clock.
 *
 * The scrollbar drives one `phase` value, and every moving part is a pure
 * function of it — the survey front that draws the root in, the cage that rides
 * that front, the length the moss and the ferns grow to, when the flowers open,
 * where the butterfly is on its approach, the drift of the pollen, and the
 * wind. That is the study's premise, and it is also why a parked scene costs
 * nothing: with no time input there is nothing to update between scrolls, so
 * the renderer stops on its last frame (DESIGN.md §5.3).
 *
 * The one live input is the pointer, which parts the moss where it passes. It
 * is positional rather than temporal, so it costs a frame per move and nothing
 * at all once the hand is still.
 *
 * The build is deferred until the stage is near the viewport, then split off
 * behind two frames — growing two roots and planting nearly 200k blades is a
 * few hundred ms of blocked main thread, and doing it during the page's
 * entrance animation is exactly when it is most visible.
 */
export function GroveDemo({
  accent,
  hint,
  headline,
  body,
  tail,
  fallbackNote,
  stageScan,
  stageGrow,
  stageSettle,
}: Props) {
  const scope = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRef = useRef<HTMLParagraphElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);

  /** 0 → 1 across the whole study. Read by the render loop. */
  const phase = useRef({ value: 0 });
  const dirtyRef = useRef(true);
  const applyRef = useRef<((p: number) => void) | null>(null);

  const [live, setLive] = useState(false);
  const [degraded, setDegraded] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const sticky = stickyRef.current;
    if (!canvas || !sticky) return;

    if (prefersSaveData() || !hasWebGL()) {
      setDegraded(true);
      return;
    }

    let disposed = false;
    let teardown: (() => void) | null = null;

    const start = () => {
      if (disposed) return;

      const small = window.innerWidth < 900;

      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: !small,
          alpha: true,
          powerPreference: "high-performance",
          stencil: false,
        });
      } catch {
        setDegraded(true);
        return;
      }
      // The shaders tone-map and encode their own output, so three must not do
      // it a second time on the way to the canvas.
      renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
      // Transparent clear, and the backdrop comes from CSS instead. Clearing to
      // a colour here would hand it to three as a *linear* value under the
      // colour space above and paint it several stops too dark; letting CSS own
      // it also means the degraded path and the live path share one backdrop
      // rather than two that have to be kept in sync.
      renderer.setClearColor(0x000000, 0);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);

      const near = buildGrove({
        variant: "near",
        blades: small ? BLADES_NEAR_SMALL : BLADES_NEAR_WIDE,
        flowers: small ? 130 : 280,
        ferns: small ? 34 : 62,
        fernSize: [0.3, 0.66],
      });
      const far = buildGrove({
        variant: "far",
        blades: small ? BLADES_FAR_SMALL : BLADES_FAR_WIDE,
        flowers: small ? 40 : 90,
        ferns: small ? 8 : 16,
        // Everything seated on the ridge is measured against FAR_SCALE, so
        // that at four times the distance it still reads finer than the near
        // root's rather than coarser.
        fernSize: [0.06, 0.13],
        flowerSize: [0.009, 0.017],
        bladeScale: 0.28,
      });

      const geometries: THREE.BufferGeometry[] = [];
      const materials: THREE.Material[] = [];
      const textures: THREE.Texture[] = [];

      /* ---- uniforms ----
         Everything the whole scene agrees on is shared BY REFERENCE, so one
         write to uPhase moves the wind, the pollen and the cage together. Only
         the terms that differ between the near root and the ridge behind it
         get their own object. */
      const shared = {
        uKeyDir: { value: new THREE.Vector3(-0.3, 0.92, 0.28).normalize() },
        uKeyCol: { value: new THREE.Color(1.14, 1.06, 0.88) },
        uFillDir: { value: new THREE.Vector3(0.12, -0.86, 0.5).normalize() },
        uFillCol: { value: new THREE.Color(0.78, 0.78, 0.62) },
        uAmbCol: { value: new THREE.Color(0.086, 0.09, 0.08) },
        uPhase: { value: 0 },
        uScanO: { value: new THREE.Vector3(-BOX_W * 0.75, -1.4, 2.2) },
        uScanR: { value: 0 },
        uWire: { value: 0 },
        uGrow: { value: 0 },
        uBloom: { value: 0 },
      };

      type Air = {
        hazeCol: [number, number, number];
        haze: number;
        fog: number;
        hazeLift: number;
        boxH: number;
        mouseR: number;
        /** local midpoint, kept half-extent, feather — see endFade() */
        cut: [number, number, number];
      };
      const groupUniforms = (air: Air) => ({
        ...shared,
        uHazeCol: { value: new THREE.Color(...air.hazeCol) },
        uHaze: { value: air.haze },
        uFog: { value: air.fog },
        uHazeLift: { value: air.hazeLift },
        uBoxH: { value: air.boxH },
        uCut: { value: new THREE.Vector3(...air.cut) },
        uMouse: { value: new THREE.Vector3(9999, 9999, 9999) },
        uMouseR: { value: air.mouseR },
      });

      const flowerMap = flowerTexture();
      const moteMap = radialTexture(64, [
        [0, "rgba(255,255,255,1)"],
        [0.35, "rgba(236,244,224,0.5)"],
        [1, "rgba(236,244,224,0)"],
      ]);
      textures.push(flowerMap, moteMap);

      /* ---- one root, assembled ---- */
      type Built = { group: THREE.Group; uniforms: ReturnType<typeof groupUniforms>; wire: THREE.LineSegments };

      const assemble = (grove: ReturnType<typeof buildGrove>, air: Air): Built => {
        const group = new THREE.Group();
        const uniforms = groupUniforms(air);
        // A form that dissolves has to blend, but it still writes depth: the
        // fade is a sliver at each end, and letting it skip the depth buffer
        // would put the ridge's own far flank in front of its near one.
        const soft = air.cut[1] < 1e5;

        const barkGeo = new THREE.BufferGeometry();
        barkGeo.setAttribute("position", new THREE.BufferAttribute(grove.bark.position, 3));
        barkGeo.setAttribute("normal", new THREE.BufferAttribute(grove.bark.normal, 3));
        barkGeo.setAttribute("aInfo", new THREE.BufferAttribute(grove.bark.info, 3));
        barkGeo.setIndex(new THREE.BufferAttribute(grove.bark.index, 1));
        const barkMat = new THREE.ShaderMaterial({
          uniforms,
          vertexShader: BARK_VERT,
          fragmentShader: BARK_FRAG,
          transparent: soft,
          depthWrite: true,
          side: THREE.DoubleSide,
        });
        const bark = new THREE.Mesh(barkGeo, barkMat);
        bark.frustumCulled = false;
        group.add(bark);
        geometries.push(barkGeo);
        materials.push(barkMat);

        /* fur: four rungs pinched to a point, instanced */
        const bladeGeo = new THREE.InstancedBufferGeometry();
        {
          const segs = 3;
          const verts: number[] = [];
          const uvs: number[] = [];
          const idx: number[] = [];
          for (let i = 0; i <= segs; i++) {
            const t = i / segs;
            const w = 0.5 * (1 - t * t);
            verts.push(-w, t, 0, w, t, 0);
            uvs.push(0, t, 1, t);
          }
          verts[verts.length - 6] = 0;
          verts[verts.length - 3] = 0;
          for (let i = 0; i < segs; i++) {
            const a = i * 2;
            idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
          }
          bladeGeo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
          bladeGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
          bladeGeo.setIndex(idx);
        }
        bladeGeo.setAttribute("aOffset", new THREE.InstancedBufferAttribute(grove.blades.offset, 3));
        bladeGeo.setAttribute("aNormal", new THREE.InstancedBufferAttribute(grove.blades.normal, 3));
        bladeGeo.setAttribute("aRandom", new THREE.InstancedBufferAttribute(grove.blades.random, 4));
        bladeGeo.setAttribute("aClump", new THREE.InstancedBufferAttribute(grove.blades.clump, 1));
        bladeGeo.instanceCount = grove.blades.count;
        const grassMat = new THREE.ShaderMaterial({
          uniforms,
          vertexShader: GRASS_VERT,
          fragmentShader: GRASS_FRAG,
          transparent: soft,
          depthWrite: true,
          side: THREE.DoubleSide,
        });
        const grass = new THREE.Mesh(bladeGeo, grassMat);
        grass.frustumCulled = false;
        grass.renderOrder = 1;
        group.add(grass);
        geometries.push(bladeGeo);
        materials.push(grassMat);

        /* ferns */
        if (grove.ferns.count > 0) {
          const fernGeo = new THREE.InstancedBufferGeometry();
          fernGeo.setAttribute("position", new THREE.BufferAttribute(grove.ferns.position, 3));
          fernGeo.setAttribute("normal", new THREE.BufferAttribute(grove.ferns.normal, 3));
          fernGeo.setAttribute("uv", new THREE.BufferAttribute(grove.ferns.uv, 2));
          fernGeo.setIndex(new THREE.BufferAttribute(grove.ferns.index, 1));
          fernGeo.setAttribute("aOffset", new THREE.InstancedBufferAttribute(grove.ferns.offset, 3));
          fernGeo.setAttribute("aQuat", new THREE.InstancedBufferAttribute(grove.ferns.quat, 4));
          fernGeo.setAttribute("aRandom", new THREE.InstancedBufferAttribute(grove.ferns.random, 2));
          fernGeo.instanceCount = grove.ferns.count;
          const fernMat = new THREE.ShaderMaterial({
            uniforms,
            vertexShader: FERN_VERT,
            fragmentShader: FERN_FRAG,
            transparent: soft,
            depthWrite: true,
            side: THREE.DoubleSide,
          });
          const fern = new THREE.Mesh(fernGeo, fernMat);
          fern.frustumCulled = false;
          fern.renderOrder = 2;
          group.add(fern);
          geometries.push(fernGeo);
          materials.push(fernMat);
        }

        /* flowers */
        if (grove.flowers.count > 0) {
          const flowerGeo = new THREE.InstancedBufferGeometry();
          flowerGeo.setAttribute(
            "position",
            new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3)
          );
          flowerGeo.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
          flowerGeo.setIndex([0, 1, 2, 0, 2, 3]);
          flowerGeo.setAttribute("aOffset", new THREE.InstancedBufferAttribute(grove.flowers.offset, 3));
          flowerGeo.setAttribute("aRandom", new THREE.InstancedBufferAttribute(grove.flowers.random, 2));
          flowerGeo.instanceCount = grove.flowers.count;
          const flowerMat = new THREE.ShaderMaterial({
            uniforms: { ...uniforms, uMap: { value: flowerMap } },
            vertexShader: FLOWER_VERT,
            fragmentShader: FLOWER_FRAG,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
          });
          const flowers = new THREE.Mesh(flowerGeo, flowerMat);
          flowers.frustumCulled = false;
          flowers.renderOrder = 3;
          group.add(flowers);
          geometries.push(flowerGeo);
          materials.push(flowerMat);
        }

        /* the survey cage */
        const wireGeo = new THREE.BufferGeometry();
        wireGeo.setAttribute("position", new THREE.BufferAttribute(grove.wire, 3));
        const wireMat = new THREE.ShaderMaterial({
          uniforms: {
            uScanO: shared.uScanO,
            uScanR: shared.uScanR,
            uWire: shared.uWire,
            uPhase: shared.uPhase,
          },
          vertexShader: WIRE_VERT,
          fragmentShader: WIRE_FRAG,
          transparent: true,
          depthWrite: false,
          depthTest: false,
          blending: THREE.AdditiveBlending,
        });
        const wire = new THREE.LineSegments(wireGeo, wireMat);
        wire.frustumCulled = false;
        wire.renderOrder = 8;
        group.add(wire);
        geometries.push(wireGeo);
        materials.push(wireMat);

        return { group, uniforms, wire };
      };

      const nearBuilt = assemble(near, {
        hazeCol: [0.176, 0.195, 0.145],
        haze: 0.15,
        fog: 0,
        hazeLift: 0.2,
        boxH: near.boxH,
        mouseR: 1.2,
        // The near root is framed whole, so nothing of it is ever cut.
        cut: [0, 1e6, 1],
      });
      scene.add(nearBuilt.group);

      /* The ridge is washed into lit air rather than into the backdrop: mixing
         distance toward the background colour is how a far object turns into a
         hole in the picture, and mixing it toward lit haze is how it turns
         into something a long way off. The darks lift here too, which they must
         not do on the near root — at that range it is what air actually does. */
      const farBuilt = assemble(far, {
        // A shade under the tone the reference washes its ridge to. That page
        // sits the ridge inside a light pool with cards over it; here it is
        // bare against the stage, and at the reference's value it comes
        // forward as a pale mound instead of receding.
        hazeCol: [0.088, 0.098, 0.072],
        haze: 0.16,
        fog: 0.26,
        hazeLift: 0.9,
        boxH: far.boxH,
        mouseR: 0.001,
        // Both ends gone well before the tube's own caps, over a long feather.
        cut: [FAR_MID_X, 3.7, 1.9],
      });
      scene.add(farBuilt.group);

      /* ---- light pool and contact shadow ---- */
      const plane = new THREE.PlaneGeometry(1, 1);
      geometries.push(plane);

      const glowMap = radialTexture(256, [
        [0, "rgba(226,236,212,0.30)"],
        [0.42, "rgba(214,226,200,0.10)"],
        [1, "rgba(214,226,200,0)"],
      ]);
      const shadowMap = radialTexture(256, [
        [0, "rgba(12,16,10,0.62)"],
        [0.45, "rgba(12,16,10,0.26)"],
        [1, "rgba(12,16,10,0)"],
      ]);
      textures.push(glowMap, shadowMap);

      const glowMat = new THREE.MeshBasicMaterial({
        map: glowMap,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const glow = new THREE.Mesh(plane, glowMat);
      glow.scale.set(26, 17, 1);
      glow.position.set(-1.6, -0.6, -11);
      glow.renderOrder = -1;
      scene.add(glow);
      materials.push(glowMat);

      const shadowMat = new THREE.MeshBasicMaterial({
        map: shadowMap,
        transparent: true,
        depthWrite: false,
      });
      const shadow = new THREE.Mesh(plane, shadowMat);
      shadow.scale.set(17, 6, 1);
      shadow.position.set(0.2, -3.1, -2.4);
      shadow.renderOrder = 0;
      scene.add(shadow);
      materials.push(shadowMat);

      /* ---- drifting pollen ---- */
      const motes = buildMotes(small ? 1200 : 3600);
      const moteGeo = new THREE.BufferGeometry();
      moteGeo.setAttribute("position", new THREE.BufferAttribute(motes.position, 3));
      moteGeo.setAttribute("aSeed", new THREE.BufferAttribute(motes.seed, 4));
      const moteUniforms = {
        uPhase: shared.uPhase,
        uMap: { value: moteMap },
        uSize: { value: 0.055 },
        uScale: { value: 400 },
        uClimb: { value: motes.climb },
      };
      const moteMat = new THREE.ShaderMaterial({
        uniforms: moteUniforms,
        vertexShader: MOTE_VERT,
        fragmentShader: MOTE_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const moteField = new THREE.Points(moteGeo, moteMat);
      moteField.frustumCulled = false;
      moteField.renderOrder = 6;
      scene.add(moteField);
      geometries.push(moteGeo);
      materials.push(moteMat);

      /* ---- the pointer's pollen trail ---- */
      const SPRAY_N = 620;
      const SPRAY_LIFE = 1.6;
      const sprayPos = new Float32Array(SPRAY_N * 3);
      const sprayVel = new Float32Array(SPRAY_N * 3);
      const sprayBirth = new Float32Array(SPRAY_N).fill(-999);
      const sprayRnd = new Float32Array(SPRAY_N * 2);
      const sprayGeo = new THREE.BufferGeometry();
      sprayGeo.setAttribute("position", new THREE.BufferAttribute(sprayPos, 3));
      sprayGeo.setAttribute("aVel", new THREE.BufferAttribute(sprayVel, 3));
      sprayGeo.setAttribute("aBirth", new THREE.BufferAttribute(sprayBirth, 1));
      sprayGeo.setAttribute("aRnd", new THREE.BufferAttribute(sprayRnd, 2));
      const sprayUniforms = {
        uNow: { value: 0 },
        uMap: { value: moteMap },
        uSize: { value: 0.075 },
        uScale: moteUniforms.uScale,
        uLife: { value: SPRAY_LIFE },
      };
      const sprayMat = new THREE.ShaderMaterial({
        uniforms: sprayUniforms,
        vertexShader: SPRAY_VERT,
        fragmentShader: SPRAY_FRAG,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      });
      const sprayField = new THREE.Points(sprayGeo, sprayMat);
      sprayField.frustumCulled = false;
      sprayField.renderOrder = 7;
      scene.add(sprayField);
      geometries.push(sprayGeo);
      materials.push(sprayMat);

      let sprayHead = 0;
      let sprayDirty = false;
      /** The live clock. It only advances while something is actually alive. */
      let now = 0;
      let lastBirth = -999;

      const spawnGrain = (p: THREE.Vector3) => {
        const i = sprayHead;
        sprayHead = (sprayHead + 1) % SPRAY_N;
        const o = i * 3;
        sprayPos[o] = p.x + (Math.random() - 0.5) * 0.16;
        sprayPos[o + 1] = p.y + (Math.random() - 0.5) * 0.16;
        sprayPos[o + 2] = p.z + (Math.random() - 0.5) * 0.48;
        sprayVel[o] = (Math.random() - 0.5) * 0.4;
        sprayVel[o + 1] = 0.012 + Math.random() * 0.33;
        sprayVel[o + 2] = (Math.random() - 0.5) * 0.28;
        sprayBirth[i] = now;
        sprayRnd[i * 2] = 0.5 + Math.random() * 0.65;
        sprayRnd[i * 2 + 1] = Math.random();
        sprayDirty = true;
        lastBirth = now;
      };

      const flushGrains = () => {
        if (!sprayDirty) return;
        const at = sprayGeo.attributes;
        at.position.needsUpdate = true;
        at.aVel.needsUpdate = true;
        at.aBirth.needsUpdate = true;
        at.aRnd.needsUpdate = true;
        sprayDirty = false;
      };

      /* ---- butterfly ---- */
      const wingMap = wingTexture();
      textures.push(wingMap);
      const bendFore = { value: 0 };
      const bendHind = { value: 0 };
      const wingMaterial = (hind: boolean, bend: { value: number }) =>
        new THREE.ShaderMaterial({
          uniforms: {
            uKeyDir: shared.uKeyDir,
            uKeyCol: shared.uKeyCol,
            uAmbCol: shared.uAmbCol,
            uBend: bend,
            uHind: { value: hind ? 1 : 0 },
            uTex: { value: wingMap },
          },
          vertexShader: WING_VERT,
          fragmentShader: WING_FRAG,
          side: THREE.DoubleSide,
        });

      const foreMat = wingMaterial(false, bendFore);
      const hindMat = wingMaterial(true, bendHind);
      const bodyMat = new THREE.ShaderMaterial({
        uniforms: {
          uKeyDir: shared.uKeyDir,
          uKeyCol: shared.uKeyCol,
          uAmbCol: shared.uAmbCol,
        },
        vertexShader: BODY_VERT,
        fragmentShader: BODY_FRAG,
      });
      const antMat = new THREE.MeshBasicMaterial({ color: 0x171208 });
      materials.push(foreMat, hindMat, bodyMat, antMat);

      const foreGeo = wingGeometry(false);
      const hindGeo = wingGeometry(true);
      const trunkGeo = bodyGeometry();
      const tegulaGeo = new THREE.SphereGeometry(0.052, 12, 9);
      const clubGeo = new THREE.SphereGeometry(0.013, 8, 6);
      geometries.push(foreGeo, hindGeo, trunkGeo, tegulaGeo, clubGeo);

      const butterfly = new THREE.Group();
      // Mirrored by a negative X scale rather than a second geometry. That
      // flips the winding, which is why the wing material is DoubleSide and
      // flips its own normal on back faces.
      const foreR = new THREE.Mesh(foreGeo, foreMat);
      const foreL = new THREE.Mesh(foreGeo, foreMat);
      const hindR = new THREE.Mesh(hindGeo, hindMat);
      const hindL = new THREE.Mesh(hindGeo, hindMat);
      foreL.scale.x = -1;
      hindL.scale.x = -1;
      foreR.position.set(0.012, 0.012, 0);
      foreL.position.copy(foreR.position);
      hindR.position.set(0.01, 0, 0);
      hindL.position.copy(hindR.position);
      butterfly.add(foreR, foreL, hindR, hindL);
      butterfly.add(new THREE.Mesh(trunkGeo, bodyMat));

      for (const sx of [1, -1] as const) {
        // tegulae — the scaled shoulder pads that weld wing to thorax
        const teg = new THREE.Mesh(tegulaGeo, bodyMat);
        teg.position.set(0.03 * sx, 0.026, 0.02);
        teg.scale.set(1.15, 0.62, 1.5);
        teg.rotation.z = -0.35 * sx;
        butterfly.add(teg);

        // antennae: thin, swept back, clubbed at the tip
        const curve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(0.01 * sx, 0.02, 0.15),
          new THREE.Vector3(0.062 * sx, 0.075, 0.3),
          new THREE.Vector3(0.105 * sx, 0.11, 0.43)
        );
        const antGeo = new THREE.TubeGeometry(curve, 12, 0.0042, 5, false);
        geometries.push(antGeo);
        butterfly.add(new THREE.Mesh(antGeo, antMat));
        const club = new THREE.Mesh(clubGeo, antMat);
        club.position.copy(curve.getPointAt(1));
        club.scale.z = 1.9;
        butterfly.add(club);
      }

      butterfly.scale.setScalar(0.21);
      butterfly.renderOrder = 5;
      butterfly.traverse((o) => {
        o.frustumCulled = false;
      });
      butterfly.visible = false;
      nearBuilt.group.add(butterfly);

      /* ---- framing ---- */

      /* The camera pushes in over the second half. Distance is solved from the
         root's own bounding radius and the vertical FOV, so the framing holds
         from a phone in portrait to an ultrawide instead of being a magic
         number tuned on one screen. */
      const fitDistance = (margin: number) => {
        const vFov = (camera.fov * Math.PI) / 180;
        const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
        return (near.reach * margin) / Math.tan(Math.min(vFov, hFov) / 2);
      };

      /** How far the front has to travel to have swept both roots. */
      let scanMax = 1;

      /* The ridge keeps a fixed size — its blade lengths were baked against it
         — and only its height is solved from the frustum, so its crest lands
         the same fraction below the look point whatever the viewport does. */
      const placeRidge = () => {
        const vFov = (camera.fov * Math.PI) / 180;
        const halfH = (fitDistance(1.18) + FAR_DEPTH) * Math.tan(vFov / 2);
        farBuilt.group.scale.setScalar(FAR_SCALE);
        farBuilt.group.position.set(
          -FAR_MID_X * FAR_SCALE,
          -0.58 * halfH - FAR_TOP * FAR_SCALE,
          -FAR_DEPTH
        );
        // The front has to sweep the ridge as well as the root in front of it,
        // or half the frame is still empty when the cage has burnt off.
        scanMax = Math.max(
          near.reach * 2.4 + 3,
          farBuilt.group.position.distanceTo(shared.uScanO.value) + far.reach * FAR_SCALE + 2
        );
      };

      const resize = () => {
        const w = sticky.clientWidth || window.innerWidth;
        const h = sticky.clientHeight || window.innerHeight;
        const dpr = Math.min(window.devicePixelRatio || 1, w * h > 2_600_000 ? 1.5 : 2);
        renderer.setPixelRatio(dpr);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        // Match three's own size attenuation: a mote of world size s at
        // distance d has to come out s * uScale / d pixels across.
        const buf = renderer.getDrawingBufferSize(new THREE.Vector2());
        moteUniforms.uScale.value = buf.y * 0.5 / Math.tan(((camera.fov * Math.PI) / 180) / 2);
        placeRidge();
        dirtyRef.current = true;
      };
      resize();

      /* ---- pointer state ----
         Declared up here because `apply` reads it, and `apply` runs once
         before any of the listeners below are attached. */
      const raycaster = new THREE.Raycaster();
      const crownPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
      const ndc = new THREE.Vector2();
      const hitWorld = new THREE.Vector3();
      const escape = new THREE.Vector3();
      const toBug = new THREE.Vector3();
      const AWAY = new THREE.Vector3(9999, 9999, 9999);
      const mouseTarget = new THREE.Vector3().copy(AWAY);
      const mouseNow = nearBuilt.uniforms.uMouse.value;
      let hovering = false;

      /* The pointer's other two jobs, both eased on the live clock: the whole
         composition leans with it, and the butterfly is wary of it. */
      const par = new THREE.Vector2();
      const parTarget = new THREE.Vector2();
      let spook = 0;
      let spookTarget = 0;
      /** Stamped on the live clock, so a sleeping loop still wakes on a move. */
      let lastMove = 0;

      /* Act one frames the whole root, because a survey of a form you cannot
         see the ends of is not a survey. Act three ends at roughly the crop
         the reference holds throughout — close enough that the fur resolves
         into single blades, which is the only framing at which planting a
         hundred and seventy thousand of them means anything. */
      const WIDE = new THREE.Vector3(0, -0.3, 0);
      const CLOSE = near.perch.clone().add(new THREE.Vector3(0.55, -0.5, 0));
      const target = new THREE.Vector3();
      const approach = new THREE.Vector3();
      const flightPos = new THREE.Vector3();
      const flightPrev = new THREE.Vector3();
      const fwd = new THREE.Vector3();
      const right = new THREE.Vector3();
      const up = new THREE.Vector3();
      const basis = new THREE.Matrix4();
      const flightQ = new THREE.Quaternion();
      const landQ = new THREE.Quaternion();

      /** Where the butterfly is at a given landing progress, 0 → 1. */
      const flightAt = (land: number, out: THREE.Vector3) => {
        // A curved approach rather than a straight line: it enters high and to
        // the right, drops past the crest, and settles back onto it.
        approach.set(
          near.perch.x + 3.4 * (1 - land),
          near.perch.y + 2.6 * (1 - land) * (1 - land) + 0.55 * Math.sin(land * 3.1),
          near.perch.z + 2.2 * (1 - land)
        );
        return out.lerpVectors(approach, near.perch, land * land);
      };

      /* The display pose: dorsal surface square to the lens, head up. The
         whole point of the landing is that the open wings are seen, and the
         camera here is barely above the root's own height — a butterfly left
         flat on the crest presents its wings edge-on and reads as a twig. */
      {
        const dorsal = new THREE.Vector3(0, 0.55, 1).normalize();
        const head = new THREE.Vector3(0, 1, 0).addScaledVector(dorsal, -dorsal.y).normalize();
        const side = new THREE.Vector3().crossVectors(dorsal, head).normalize();
        landQ.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, dorsal, head));
        landQ.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.1));
        landQ.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.14));
      }

      const apply = (p: number) => {
        const clamped = Math.min(Math.max(p, 0), 1);
        shared.uPhase.value = clamped * 7.5;

        // Act one: the front sweeps the whole box and a little past it, with
        // the cage snapping on at once and burning off behind the front.
        // It starts a little way out rather than at nothing: the stage pins
        // with the study at phase zero, and a front of radius zero means
        // arriving at an empty rectangle with a caption on it.
        const scan = Math.min(clamped / 0.34, 1);
        shared.uScanR.value = (0.055 + 0.945 * scan) * scanMax;
        // Full strength from the first frame, to match the front's own head
        // start — ramping it up from zero leaves the one thing already on
        // screen at phase zero standing there without its cage.
        const wire = 1 - THREE.MathUtils.smoothstep(clamped, 0.245, 0.36);
        shared.uWire.value = wire;
        nearBuilt.wire.visible = wire > 0.002;
        farBuilt.wire.visible = wire > 0.002;

        // Act two: the cushion grows, the ferns unfurl behind it, and the
        // flowers open behind them.
        shared.uGrow.value = THREE.MathUtils.smoothstep(clamped, 0.22, 0.62);
        shared.uBloom.value = THREE.MathUtils.smoothstep(clamped, 0.42, 0.78);

        // Act three: push in, and bring the butterfly down onto the crest. The
        // copy steps aside as the camera arrives — it has said its piece by
        // then, and the push-in puts the root exactly where the text was.
        if (copyRef.current) {
          const fade = 1 - THREE.MathUtils.smoothstep(clamped, 0.7, 0.9);
          copyRef.current.style.opacity = fade.toFixed(3);
        }
        const dolly = THREE.MathUtils.smoothstep(clamped, 0.5, 1);
        target.lerpVectors(WIDE, CLOSE, dolly);
        const dist = THREE.MathUtils.lerp(fitDistance(1.05), fitDistance(0.36), dolly);
        /* Parallax. The offsets are fractions of the camera's own distance
           rather than fixed world units, so the lean is the same on screen at
           the wide framing and at the close one — at a constant offset it
           barely registers across the frame at the start and swings the whole
           picture by the end. */
        const px = -par.x * dist * 0.0186;
        const py = par.y * dist * 0.0114;
        camera.position.set(
          Math.sin(-0.24 * dolly) * dist + px,
          target.y + 0.9 + 0.5 * dolly + py,
          Math.cos(-0.24 * dolly) * dist
        );
        camera.lookAt(target.x + px * 0.42, target.y + 0.28 * dolly + py * 0.42, target.z);
        nearBuilt.group.rotation.set(par.y * 0.026, par.x * 0.055, 0);
        farBuilt.group.rotation.y = par.x * 0.03;

        const land = THREE.MathUtils.smoothstep(clamped, 0.6, 0.97);
        butterfly.visible = land > 0.001;
        if (butterfly.visible) {
          flightAt(land, flightPos);
          butterfly.position.copy(flightPos);

          // Orientation off the path's own tangent rather than a hand-set
          // Euler: the approach curves through most of a right angle, and a
          // fixed heading has the animal flying sideways for half of it.
          flightAt(Math.max(0, land - 0.02), flightPrev);
          fwd.subVectors(flightPos, flightPrev);
          if (fwd.lengthSq() < 1e-8) fwd.set(0, 0, 1);
          fwd.normalize();
          right.crossVectors(fwd, new THREE.Vector3(0, 1, 0));
          if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
          right.normalize();
          up.crossVectors(right, fwd).normalize();
          basis.makeBasis(right, up, fwd);
          flightQ.setFromRotationMatrix(basis);

          const settle = THREE.MathUtils.smoothstep(land, 0.78, 1);
          butterfly.quaternion.copy(flightQ).slerp(landQ, settle);

          /* A perched insect will not stay put. Once the feet are down the
             pointer can spook it: it leans away from the hand, lifts, and beats
             harder — and it does that on the live clock rather than on the
             scrollbar, because an animal that only reacts while you are
             scrolling is not reacting to you at all. */
          if (spook > 0.002 && mouseNow.x < 999) {
            escape.set(butterfly.position.x - mouseNow.x, 0, butterfly.position.z - mouseNow.z);
            if (escape.lengthSq() < 1e-6) escape.set(1, 0, 0);
            escape.normalize();
            butterfly.position.addScaledVector(escape, spook * settle * 0.5);
            butterfly.position.y += spook * settle * 0.34;
          }

          // Wings beat hard on the way in, settle to a slow display once the
          // feet are down, and flare open as the hand closes in.
          const flap = clamped * 150 + now * (1.7 + 46 * spook) * settle;
          const raw = Math.sin(flap);
          const shaped = Math.sign(raw) * Math.pow(Math.abs(raw), 0.72);
          const flyPhi = 20 + 48 * shaped;
          const restPhi = 15 + 7 * shaped + spook * 30;
          const phi = THREE.MathUtils.lerp(flyPhi, restPhi, settle) * THREE.MathUtils.DEG2RAD;
          foreR.rotation.z = phi;
          foreL.rotation.z = -phi;
          hindR.rotation.z = phi * 0.95 - 0.03;
          hindL.rotation.z = -(phi * 0.95 - 0.03);
          const flapVel = Math.cos(flap) * 8.6 * (1 - 0.9 * settle * (1 - spook));
          bendFore.value = -flapVel * 0.01;
          bendHind.value = -flapVel * 0.013;

          butterfly.position.y += Math.sin(flap - 0.9) * 0.022 * (1 - settle * (1 - spook));
          butterfly.scale.setScalar(0.21 * (0.78 + 0.22 * land));
        }
      };
      applyRef.current = apply;
      apply(phase.current.value);

      /* ---- the pointer parts the moss ----
         The influence point is carried in the near root's LOCAL space, because
         that is the space the blades are planted in — and the group now leans
         with the parallax, so the world hit has to be pushed back through that
         transform every frame rather than copied once. */
      const toLocalMouse = () => {
        if (!hovering) {
          mouseTarget.copy(AWAY);
          return;
        }
        mouseTarget.copy(hitWorld);
        nearBuilt.group.worldToLocal(mouseTarget);
      };

      const settleMouse = () => {
        if (mouseTarget.x > 999) {
          if (mouseNow.x > 999) return false;
          // Let go rather than teleport: snapping the influence point to
          // infinity springs the whole cushion back on one frame.
          mouseNow.lerp(mouseTarget, 0.5);
          if (mouseNow.distanceToSquared(mouseTarget) < 1) mouseNow.copy(mouseTarget);
          return true;
        }
        if (mouseNow.x > 999) {
          mouseNow.copy(mouseTarget);
          return true;
        }
        if (mouseNow.distanceToSquared(mouseTarget) < 1e-6) return false;
        mouseNow.lerp(mouseTarget, 0.22);
        return true;
      };

      /* Emission by DISTANCE rather than by time, spread along the segment the
         pointer covered since the last frame: a fast sweep lays a trail instead
         of stacking a clump wherever the cursor happened to land, and a hand
         that has stopped trickles instead of pumping. */
      const sprayLast = new THREE.Vector3(9999, 0, 0);
      const sprayStep = new THREE.Vector3();
      let sprayIdle = 0;

      const emitSpray = (dt: number, moving: boolean) => {
        // The trickle is for a pointer creeping too slowly to trip the distance
        // test, not for one that has been put down. Letting a parked cursor go
        // on shedding a grain every 55ms keeps the live layer awake for ever —
        // which is exactly the cost this study is built to avoid.
        if (!hovering || mouseTarget.x > 999 || !moving) {
          sprayLast.x = 9999; // re-entering should not lay a streak across the frame
          return;
        }
        if (sprayLast.x > 9000) {
          sprayLast.copy(mouseTarget);
          return;
        }
        const n = Math.min(14, Math.floor(mouseTarget.distanceTo(sprayLast) / 0.037));
        for (let k = 1; k <= n; k++) {
          sprayStep.lerpVectors(sprayLast, mouseTarget, k / n);
          spawnGrain(sprayStep);
        }
        if (n > 0) {
          sprayLast.copy(mouseTarget);
          sprayIdle = 0;
        } else {
          sprayIdle += dt;
          if (sprayIdle > 0.055) {
            spawnGrain(mouseTarget);
            sprayIdle = 0;
          }
        }
        flushGrains();
      };

      const onPointerMove = (e: PointerEvent) => {
        if (e.pointerType === "touch") return;
        const r = canvas.getBoundingClientRect();
        ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        parTarget.set(ndc.x, -ndc.y);
        camera.updateMatrixWorld();
        raycaster.setFromCamera(ndc, camera);
        hovering = !!raycaster.ray.intersectPlane(crownPlane, hitWorld);
        toLocalMouse();
        lastMove = now;
        dirtyRef.current = true;
      };
      const onPointerLeave = () => {
        hovering = false;
        parTarget.set(0, 0);
        mouseTarget.copy(AWAY);
        lastMove = now;
        dirtyRef.current = true;
      };
      canvas.addEventListener("pointermove", onPointerMove, { passive: true });
      canvas.addEventListener("pointerleave", onPointerLeave, { passive: true });

      const onResize = () => {
        resize();
        apply(phase.current.value);
        ScrollTrigger.refresh();
      };
      window.addEventListener("resize", onResize, { passive: true });

      let visible = !document.hidden;
      const onVisibility = () => {
        visible = !document.hidden;
        if (visible) dirtyRef.current = true;
      };
      document.addEventListener("visibilitychange", onVisibility);

      /* One clock for the whole site: gsap.ticker already drives Lenis, and a
         second rAF loop here would fight it for frames.

         The live layer — parallax, the pollen trail, the butterfly's nerve —
         runs only while there is something left for it to do: a hand over the
         stage, grains still in the air, a lean still easing home, or a startled
         insect still calming down. Every one of those is finite, so the loop
         drains itself and the scene goes back to costing nothing, which is the
         standing rule for the canvas layers here (DESIGN.md §5.3). What it is
         not is a scene idling at 60fps to sway grass nobody is looking at. */
      const tick = (_time: number, deltaMs: number) => {
        if (disposed || !visible) return;
        const dt = Math.min(deltaMs / 1000, 0.05);

        /* Liveness is about what is still CHANGING, not about where the hand
           happens to be resting. Keying it on hover instead looks identical and
           costs a permanent 60fps for as long as a motionless cursor sits over
           the stage — measured, and the reason this reads the way it does.
           Every term here is finite: grains expire, the lean reaches its target,
           the startle eases out, and the grace window closes. */
        const grainsAlive = now < lastBirth + SPRAY_LIFE;
        const leaning = Math.abs(par.x - parTarget.x) > 2e-4 || Math.abs(par.y - parTarget.y) > 2e-4;
        const startling = Math.abs(spook - spookTarget) > 1e-3;
        const justMoved = now - lastMove < 0.25;
        if (grainsAlive || leaning || startling || justMoved) {
          now += dt;
          sprayUniforms.uNow.value = now;

          // Frame-rate independent easing, so the lean lands the same on a
          // 60Hz panel and a 144Hz one.
          const k = 1 - Math.pow(0.04, dt);
          par.x += (parTarget.x - par.x) * k;
          par.y += (parTarget.y - par.y) * k;
          // Geometric easing approaches but never arrives; snap inside the
          // threshold the liveness test uses, or the loop has no last frame.
          if (Math.abs(par.x - parTarget.x) <= 2e-4) par.x = parTarget.x;
          if (Math.abs(par.y - parTarget.y) <= 2e-4) par.y = parTarget.y;

          // The parallax moves the group, so the influence point has to be
          // re-derived before anything reads it.
          toLocalMouse();
          emitSpray(dt, justMoved);

          /* How close is the hand, and from where. z is weighted down because
             the pointer is resolved on one plane and the butterfly is not on
             it; what matters is whether the cursor is over the animal on
             screen. Snaps on, lets go slowly — a startled insect does not calm
             instantly. */
          spookTarget = 0;
          if (hovering && mouseNow.x < 999 && butterfly.visible) {
            /* Measured against where the flight path PUTS it, not against
               where the startle has already pushed it to. Reading the
               displaced position feeds the offset back into its own input: the
               animal shies away, is therefore further from the hand, relaxes,
               drifts back, and shies again — a loop with no fixed point, which
               also means the live layer never gets a last frame. */
            toBug.set(
              mouseNow.x - flightPos.x,
              mouseNow.y - flightPos.y,
              (mouseNow.z - flightPos.z) * 0.3
            );
            spookTarget = Math.min(1, Math.max(0, 1 - toBug.length() / 0.62));
            spookTarget *= spookTarget;
          }
          spook += (spookTarget - spook) * (1 - Math.pow(spookTarget > spook ? 1e-7 : 0.22, dt));
          if (Math.abs(spook - spookTarget) < 1e-3) spook = spookTarget;

          apply(phase.current.value);
          dirtyRef.current = true;
        }

        if (settleMouse()) dirtyRef.current = true;
        if (!dirtyRef.current) return;
        dirtyRef.current = false;
        renderer.render(scene, camera);
      };
      gsap.ticker.add(tick);

      renderer.render(scene, camera);
      setLive(true);
      ScrollTrigger.refresh();

      teardown = () => {
        gsap.ticker.remove(tick);
        window.removeEventListener("resize", onResize);
        document.removeEventListener("visibilitychange", onVisibility);
        canvas.removeEventListener("pointermove", onPointerMove);
        canvas.removeEventListener("pointerleave", onPointerLeave);
        applyRef.current = null;
        // Collected as they were made rather than walked off the graph: the
        // wings share two geometries and two materials across four meshes, and
        // a traverse would dispose each of those several times over.
        for (const g of geometries) g.dispose();
        for (const m of materials) m.dispose();
        for (const t of textures) t.dispose();
        renderer.dispose();
      };
    };

    /* Viewport-gated: building the roots is a few hundred ms of blocked main
       thread, and the lab index links straight here — so it waits until the
       stage is actually approaching, then hands the browser two frames to
       finish painting the page's own entrance before it takes the thread. */
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        requestAnimationFrame(() => requestAnimationFrame(start));
      },
      { rootMargin: "200% 0px" }
    );
    io.observe(sticky);

    return () => {
      disposed = true;
      io.disconnect();
      teardown?.();
    };
  }, []);

  useGSAP(
    () => {
      const stage = stageRef.current;
      const sticky = stickyRef.current;
      if (!live || !stage || !sticky) return;

      const labels = [stageScan, stageGrow, stageSettle];
      let shown = -1;

      const tween = gsap.to(phase.current, {
        value: 1,
        ease: "none",
        // The tween's own onUpdate rather than the ScrollTrigger's: with
        // `scrub` the catch-up tween keeps running after the scrollbar has
        // stopped, and a ScrollTrigger callback stops firing at that moment —
        // which would park the scene one frame short of where it was scrolled.
        onUpdate: () => {
          applyRef.current?.(phase.current.value);
          dirtyRef.current = true;
          const act = phase.current.value < 0.34 ? 0 : phase.current.value < 0.66 ? 1 : 2;
          if (act !== shown && labelRef.current) {
            shown = act;
            labelRef.current.textContent = labels[act];
          }
        },
        scrollTrigger: {
          trigger: stage,
          start: "top top",
          end: "bottom bottom",
          pin: sticky,
          pinSpacing: false,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          scrub: 0.8,
        },
      });

      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
      };
    },
    // revertOnUpdate is required whenever dependencies and a teardown are both
    // present (DESIGN.md §1.5): without it the cleanup is deferred to unmount
    // and a dependency change leaves a second ScrollTrigger behind.
    { scope, dependencies: [live], revertOnUpdate: true }
  );

  return (
    <div ref={scope} style={{ "--gv-accent": accent } as CSSProperties}>
      <style href="lab-grove" precedence="medium">
        {CSS}
      </style>

      <div ref={stageRef} className="gv-stage" data-degraded={degraded || undefined}>
        <div ref={stickyRef} className="gv-sticky">
          <canvas ref={canvasRef} className="gv-canvas" data-degraded={degraded || undefined} />

          <div ref={copyRef} className="gv-copy">
            <h2 className="gv-headline">{headline}</h2>
            <p className="gv-body">{body}</p>
            <p className="gv-tail">{tail}</p>
            {degraded && <p className="gv-note">{fallbackNote}</p>}
          </div>

          <p ref={labelRef} className="gv-act" aria-hidden="true">
            {stageScan}
          </p>
          <p className="gv-hint" aria-hidden="true">
            {hint}
          </p>
        </div>
      </div>
    </div>
  );
}

const CSS = `
/* Three acts at roughly a screen and a half each: the scan needs room to read
   as a sweep rather than a flash, and the dolly needs room to feel like a walk
   toward the root rather than a zoom. */
.gv-stage { position: relative; height: 460vh; }
/* Without WebGL there is no scene, so nothing pins and nothing is driven —
   which would leave the scroll track above as three and a half blank screens
   under the copy. Collapse it to the one screen that still has something on it. */
.gv-stage[data-degraded] { height: 100svh; }
.gv-sticky {
  position: relative;
  height: 100svh;
  overflow: hidden;
  border-block: 1px solid var(--line);
  /* Also the backdrop when WebGL is unavailable, so the copy stays legible.
     A mid grey-green rather than the near-black this started on: every colour
     in these shaders was solved against lit forest air, and dropping that air
     onto a dark stage takes the moss with it — the greens lose their hue and
     the whole render silts up into one murky mid-tone. The two pools are the
     light on the floor and the shade in the far corner. */
  background:
    radial-gradient(64% 52% at 27% 84%, rgba(232, 238, 222, 0.086) 0%, rgba(232, 238, 222, 0) 72%),
    radial-gradient(70% 60% at 92% 8%, rgba(24, 28, 20, 0.1) 0%, rgba(24, 28, 20, 0) 68%),
    #4a4d44;
}
.gv-canvas { display: block; width: 100%; height: 100%; }
.gv-canvas[data-degraded] { visibility: hidden; }

.gv-copy {
  position: absolute;
  inset: auto 0 12vh;
  margin-inline: auto;
  max-width: min(34ch, 82vw);
  text-align: center;
  color: #f2efe4;
  text-shadow: 0 2px 28px rgba(0, 0, 0, 0.55);
  /* The pointer has to reach the moss underneath: the copy is a caption over
     the scene, not a lid on it. */
  pointer-events: none;
}
.gv-headline {
  margin: 0;
  font-size: clamp(1.7rem, 5vw, 3rem);
  font-weight: 600;
  letter-spacing: -0.02em;
}
.gv-body {
  margin: 0.9rem 0 0;
  font-size: 0.9375rem;
  line-height: 1.7;
  opacity: 0.82;
}
.gv-tail {
  margin: 1.1rem 0 0;
  font-family: var(--font-stack-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--gv-accent);
  text-shadow: none;
}
.gv-note {
  margin: 1rem 0 0;
  font-size: 0.8125rem;
  line-height: 1.6;
  opacity: 0.66;
}

/* The act marker sits opposite the scroll hint so the two never collide on a
   narrow viewport. */
.gv-act,
.gv-hint {
  position: absolute;
  bottom: clamp(1rem, 4vw, 2.5rem);
  margin: 0;
  font-family: var(--font-stack-mono);
  font-size: 0.625rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  pointer-events: none;
}
.gv-act {
  left: clamp(1rem, 4vw, 2.5rem);
  color: var(--gv-accent);
}
.gv-hint {
  right: clamp(1rem, 4vw, 2.5rem);
  color: rgba(242, 239, 228, 0.42);
}
`;
