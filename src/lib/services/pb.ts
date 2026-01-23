import PocketBase from "pocketbase";
import { PUBLIC_POCKETBASE_URL } from "$env/static/public";

export const pb = new PocketBase(PUBLIC_POCKETBASE_URL);

// Helpful during dev so rapid requests don't cancel each other
pb.autoCancellation(false);
