import { pb } from "./pb";

let initialized = false;

/**
 * Call once on the client to keep auth state fresh and available.
 */
export function initPocketbaseClient() {
  if (initialized) return;
  initialized = true;

  // Example: log auth changes (you can wire to a Svelte store instead)
  pb.authStore.onChange(() => {
    // e.g. update a store here
    // console.log("Auth changed:", pb.authStore.isValid);
  }, true);
}
