import "server-only";

import { cache } from "react";

/** One instant per server render; never keep a warm process's date in module state. */
export const requestTime = cache(() => new Date());
