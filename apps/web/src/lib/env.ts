import { z } from "zod";

// NEXT_PUBLIC_* is inlined at build time, so this parses once per static export.
export const env = {
  apiUrl: z.url().parse(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"),
};
