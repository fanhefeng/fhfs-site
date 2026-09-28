/**
 * How many blades are planted, per root, by viewport.
 *
 * The shell under them is only ~20k vertices, so this number IS the build
 * cost of the grove (`./geometry`). It lives in a file of its own, with no
 * imports, because the study page quotes it in its spec table from the
 * server: reading four numbers out of `./geometry` pulled three.js and the
 * whole 1,200-line builder into the server bundle of every lab page.
 */
export const BLADES_NEAR_WIDE = 175_000;
export const BLADES_NEAR_SMALL = 46_000;
export const BLADES_FAR_WIDE = 55_000;
export const BLADES_FAR_SMALL = 13_000;
