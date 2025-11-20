import { createClient } from "@nhost/nhost-js";

const subdomain = import.meta.env.VITE_NHOST_SUBDOMAIN;
const region = import.meta.env.VITE_NHOST_REGION;

if (!subdomain || !region) {
  console.warn("Nhost configuration is missing. Set VITE_NHOST_SUBDOMAIN and VITE_NHOST_REGION.");
}

export const nhost = createClient({
subdomain: subdomain,
region: region
})