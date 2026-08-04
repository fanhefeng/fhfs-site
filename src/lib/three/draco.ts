/**
 * Where the Draco decoder is served from.
 *
 * Both GLBs on this site are Draco-compressed, so neither can be parsed
 * without it — `KHR_draco_mesh_compression` sits in their `extensionsRequired`.
 *
 * It has to be stated explicitly at every call site, because the default is
 * wrong in opposite ways depending on the loader: drei's `useGLTF` silently
 * points a `DRACOLoader` at `https://www.gstatic.com/draco/versioned/…`, and
 * three's bare `DRACOLoader` has no default at all. The CDN version is the
 * dangerous one — it works on the first try and then costs a cross-origin
 * round trip before the first frame, breaks offline and in restricted
 * networks, and pins the site to a third party for a file already sitting in
 * `public/`. Same reasoning as refusing drei's `<Environment preset>`.
 */
export const DRACO_DECODER_PATH = "/draco/";
