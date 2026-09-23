import { readFileSync } from "node:fs";

// The preview container has production dependencies only. Reuse the image
// settings serialized by the build instead of loading next.config.ts at runtime.
const { config } = JSON.parse(readFileSync(new URL("./.next/required-server-files.json", import.meta.url), "utf8"));

export default { images: config.images };
