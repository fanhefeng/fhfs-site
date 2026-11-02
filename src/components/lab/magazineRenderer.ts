import { gsap, EASE, isFinePointer } from "@/lib/client/gsap";
import { compileProgram } from "@/lib/client/webgl";

/** Local types until these emerging APIs reach TypeScript's DOM library. */
type DrawableCanvas = HTMLCanvasElement & {
  content?: string;
  requestPaint: () => void;
  getElementImageDefaultSize?: (element: Element) => { width: number; height: number };
  updateElementGeometry?: (element: Element, options?: { canvasTransform: DOMMatrix }) => void;
  clearElementGeometry?: (element: Element) => void;
};
type DrawableGL = WebGL2RenderingContext & {
  texElementSubImage2D?: (
    target: number,
    level: number,
    x: number,
    y: number,
    element: Element,
  ) => void;
  texElementImage2D?: (target: number, format: number, element: Element) => void;
};

const VERTEX = /* glsl */ `#version 300 es
uniform mat4 uTransform;
uniform vec2 uViewport;
uniform vec2 uCard;
out vec2 vUv;
void main() {
  vec2 uv = vec2((gl_VertexID >> 1) & 1, gl_VertexID & 1);
  vec4 p = uTransform * vec4(uv * uCard, 0., 1.);
  gl_Position = vec4(2. * p.x / uViewport.x - p.w, p.w - 2. * p.y / uViewport.y, 0., p.w);
  vUv = uv;
}`;
const FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uCover;
uniform vec2 uLight;
uniform bool uEdge;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec4 paper = texture(uCover, vUv);
  if (uEdge) {
    outColor = vec4(paper.rgb * .72, paper.a);
    return;
  }
  float shine = pow(max(0., 1. - abs(vUv.x * .8 + vUv.y * .2 - uLight.x)), 18.);
  float shade = (vUv.x - .5) * uLight.y;
  outColor = vec4(paper.rgb * (1. + shade) + vec3(.045 * shine) * paper.a, paper.a);
}`;

export type MagazineRenderer = {
  turn: (direction: -1 | 1) => void;
  reset: () => void;
  dispose: () => void;
};

/**
 * One plane, one DOM snapshot. No scene graph or continuous animation loop.
 * The same projective matrix drives pixels and native DOM hit testing;
 * lamination only changes colour, so text and links stay under the pointer.
 */
export function mountMagazine({
  canvas: surface,
  cover,
  stage,
  onLive,
  onFail,
}: {
  canvas: HTMLCanvasElement;
  cover: HTMLElement;
  stage: HTMLElement;
  onLive: () => void;
  onFail: () => void;
}): MagazineRenderer | null {
  const canvas = surface as DrawableCanvas;
  let gl: DrawableGL | null = null;
  try {
    gl = canvas.getContext("webgl2", { alpha: true, antialias: true }) as DrawableGL | null;
  } catch {
    /* A blocked GPU gets the HTML edition. */
  }
  // Transitional Chrome builds expose `content` but still use CSS geometry
  // and the two-argument getElementTransform trial. The default-size method
  // identifies the shipped API whose canvasTransform option is implemented.
  const modern = typeof canvas.getElementImageDefaultSize === "function";
  if (
    !gl ||
    !canvas.requestPaint ||
    (modern ? !gl.texElementSubImage2D || !canvas.updateElementGeometry : !gl.texElementImage2D)
  ) {
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    onFail();
    return null;
  }
  const gpu = gl;
  const program = compileProgram(gpu, VERTEX, FRAGMENT, "magazine");
  const texture = gpu.createTexture();
  if (!program || !texture) {
    if (program) gpu.deleteProgram(program);
    if (texture) gpu.deleteTexture(texture);
    gpu.getExtension("WEBGL_lose_context")?.loseContext();
    onFail();
    return null;
  }
  const uniform = (name: string) => gpu.getUniformLocation(program, name);
  const uniforms = {
    transform: uniform("uTransform"),
    viewport: uniform("uViewport"),
    card: uniform("uCard"),
    light: uniform("uLight"),
    edge: uniform("uEdge"),
  };
  gpu.useProgram(program);
  gpu.activeTexture(gpu.TEXTURE0);
  gpu.bindTexture(gpu.TEXTURE_2D, texture);
  gpu.texParameteri(gpu.TEXTURE_2D, gpu.TEXTURE_MIN_FILTER, gpu.LINEAR);
  gpu.texParameteri(gpu.TEXTURE_2D, gpu.TEXTURE_MAG_FILTER, gpu.LINEAR);
  gpu.texParameteri(gpu.TEXTURE_2D, gpu.TEXTURE_WRAP_S, gpu.CLAMP_TO_EDGE);
  gpu.texParameteri(gpu.TEXTURE_2D, gpu.TEXTURE_WRAP_T, gpu.CLAMP_TO_EDGE);
  gpu.uniform1i(uniform("uCover"), 0);
  gpu.enable(gpu.BLEND);
  gpu.blendFunc(gpu.ONE, gpu.ONE_MINUS_SRC_ALPHA);
  gpu.clearColor(0, 0, 0, 0);

  let disposed = false;
  let visible = true;
  let uploaded = false;
  let announced = false;
  let textureWidth = 0;
  let textureHeight = 0;
  let tween: gsap.core.Tween | null = null;
  const pose = { x: -6, y: -12 };
  const active = () => !disposed && visible && !document.hidden;
  const selecting = () => {
    const selection = window.getSelection();
    return Boolean(selection && !selection.isCollapsed && cover.contains(selection.anchorNode));
  };
  const reveal = () => {
    const html = stage.querySelector(".mag-html");
    const selection = window.getSelection();
    if (
      disposed ||
      !uploaded ||
      announced ||
      html?.contains(document.activeElement) ||
      (selection && !selection.isCollapsed && html?.contains(selection.anchorNode))
    )
      return;
    announced = true;
    onLive();
  };
  const draw = () => {
    if (!active() || !uploaded) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const cardWidth = cover.offsetWidth;
    const cardHeight = cover.offsetHeight;
    const perspective = new DOMMatrix();
    perspective.m34 = -1 / 1000;
    const transform = new DOMMatrix()
      .translate(width / 2, height / 2)
      .multiply(perspective)
      .rotate(pose.x, pose.y, -2)
      .translate(-cardWidth / 2, -cardHeight / 2);
    gpu.clear(gpu.COLOR_BUFFER_BIT);
    gpu.useProgram(program);
    gpu.uniform2f(uniforms.viewport, width, height);
    gpu.uniform2f(uniforms.card, cardWidth, cardHeight);
    gpu.uniform2f(uniforms.light, 0.35 + pose.y / 55, pose.y / 180);
    // The three thin sheets behind the cover make its paper edge visible.
    gpu.uniform1i(uniforms.edge, 1);
    for (let sheet = 3; sheet > 0; sheet--) {
      gpu.uniformMatrix4fv(
        uniforms.transform,
        false,
        transform.translate(sheet, sheet, -sheet).toFloat32Array(),
      );
      gpu.drawArrays(gpu.TRIANGLE_STRIP, 0, 4);
    }
    gpu.uniform1i(uniforms.edge, 0);
    gpu.uniformMatrix4fv(uniforms.transform, false, transform.toFloat32Array());
    gpu.drawArrays(gpu.TRIANGLE_STRIP, 0, 4);
    if (modern) canvas.updateElementGeometry!(cover, { canvasTransform: transform });
    else {
      cover.style.transform = transform.toString();
      // Transitional builds still position descendants through CSS, but need
      // this call to register them in the canvas's native hit-test order.
      canvas.updateElementGeometry?.(cover);
    }
    reveal();
  };
  const fail = () => {
    if (!disposed) onFail();
  };
  const requestPaint = () => {
    if (active()) canvas.requestPaint();
  };
  const paint = () => {
    if (!active()) return;
    try {
      gpu.bindTexture(gpu.TEXTURE_2D, texture);
      if (modern) {
        const size = canvas.getElementImageDefaultSize?.(cover);
        const width = Math.ceil(
          size?.width ?? (cover.offsetWidth * canvas.width) / canvas.clientWidth,
        );
        const height = Math.ceil(
          size?.height ?? (cover.offsetHeight * canvas.height) / canvas.clientHeight,
        );
        if (width !== textureWidth || height !== textureHeight) {
          gpu.texImage2D(
            gpu.TEXTURE_2D,
            0,
            gpu.RGBA8,
            width,
            height,
            0,
            gpu.RGBA,
            gpu.UNSIGNED_BYTE,
            null,
          );
          textureWidth = width;
          textureHeight = height;
        }
        gpu.texElementSubImage2D!(gpu.TEXTURE_2D, 0, 0, 0, cover);
      } else {
        gpu.texElementImage2D!(gpu.TEXTURE_2D, gpu.RGBA8, cover);
      }
      if (gpu.getError() !== gpu.NO_ERROR) {
        fail();
        return;
      }
      uploaded = true;
      draw();
    } catch {
      fail();
    }
  };
  const move = (x: number, y: number) => {
    if (!active()) return;
    tween?.kill();
    tween = gsap.to(pose, { x, y, duration: 0.65, ease: EASE.soft, onUpdate: draw });
  };
  const hover = (event: PointerEvent) => {
    if (
      !isFinePointer() ||
      event.pointerType !== "mouse" ||
      event.buttons ||
      selecting() ||
      cover.contains(document.activeElement)
    )
      return;
    const box = stage.getBoundingClientRect();
    move(
      (-(event.clientY - box.top - box.height / 2) / box.height) * 16,
      ((event.clientX - box.left - box.width / 2) / box.width) * 24,
    );
  };
  const leave = () => {
    if (!selecting() && !cover.contains(document.activeElement)) move(-6, -12);
  };
  const hold = () => tween?.kill();
  const measure = () => {
    if (disposed) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(canvas.clientWidth * dpr);
    const height = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gpu.viewport(0, 0, width, height);
    }
    requestPaint();
  };
  const sync = () => {
    if (active()) {
      tween?.resume();
      requestPaint();
    } else tween?.pause();
  };
  const lost = (event: Event) => {
    event.preventDefault();
    fail();
  };
  const resize = new ResizeObserver(measure);
  resize.observe(stage);
  resize.observe(cover);
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? true;
    sync();
  });
  intersection.observe(stage);
  canvas.addEventListener("paint", paint);
  canvas.addEventListener("webglcontextlost", lost);
  stage.addEventListener("pointermove", hover);
  stage.addEventListener("pointerleave", leave);
  stage.addEventListener("pointerdown", hold);
  stage.addEventListener("focusin", hold);
  stage.addEventListener("focusout", reveal);
  document.addEventListener("selectionchange", reveal);
  document.addEventListener("visibilitychange", sync);
  // DOM pixels stay in the browser's own rendering pipeline. See
  // https://developer.chrome.com/docs/web-platform/html-in-canvas/webgl
  canvas.setAttribute(modern ? "content" : "layoutsubtree", modern ? "drawable" : "");
  cover.setAttribute("drawable", "");
  measure();
  const timeout = window.setTimeout(() => {
    if (!uploaded && active()) fail();
  }, 5000);

  return {
    turn: (direction) => move(pose.x, Math.max(-24, Math.min(24, pose.y + direction * 12))),
    reset: () => move(-6, -12),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      window.clearTimeout(timeout);
      tween?.kill();
      resize.disconnect();
      intersection.disconnect();
      canvas.removeEventListener("paint", paint);
      canvas.removeEventListener("webglcontextlost", lost);
      stage.removeEventListener("pointermove", hover);
      stage.removeEventListener("pointerleave", leave);
      stage.removeEventListener("pointerdown", hold);
      stage.removeEventListener("focusin", hold);
      stage.removeEventListener("focusout", reveal);
      document.removeEventListener("selectionchange", reveal);
      document.removeEventListener("visibilitychange", sync);
      canvas.clearElementGeometry?.(cover);
      cover.style.removeProperty("transform");
      gpu.deleteTexture(texture);
      gpu.deleteProgram(program);
      // React may reuse this canvas during an effect remount. Releasing our
      // resources is safe; forcibly losing its context would break that remount.
    },
  };
}
