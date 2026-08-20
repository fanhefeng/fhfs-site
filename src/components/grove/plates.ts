import * as THREE from "three";

/**
 * The scene's baked plates and its two modelled parts.
 *
 * Everything here is a pure function of nothing: given a document to make a
 * canvas in, each returns the same texture or the same geometry every time.
 * They live apart from either page because both grow the same moss, and a
 * wing outline that drifts between the two would be a bug nobody would think
 * to look for.
 */

/* ────────────────────────────────────────────────────────────────────────
   baked plates
   ──────────────────────────────────────────────────────────────────────── */

/**
 * A spray, not a bloom. One five-petal flower at this size renders as a little
 * asterisk; what reads as white-flowered moss is a cluster of florets, so the
 * plate carries the whole cluster and each instance draws one spray.
 */
export function flowerTexture(): THREE.CanvasTexture {
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
export function radialTexture(size: number, stops: [number, string][]): THREE.CanvasTexture {
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
export function wingTexture(): THREE.CanvasTexture {
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
export function wingGeometry(hind: boolean): THREE.BufferGeometry {
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
export function bodyGeometry(): THREE.BufferGeometry {
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
