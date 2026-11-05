// Browser-visible config. Next.js inlines only NEXT_PUBLIC_* names at build time.
// Every name here is listed in .env.example. Nothing secret may be NEXT_PUBLIC_.

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing ${name}. Copy .env.example to .env.local and fill it in.`);
  return value;
}

export const env = {
  /** The Worker's base URL, e.g. https://pata-server.<account>.workers.dev */
  get serverUrl() {
    return required("NEXT_PUBLIC_SERVER_URL", process.env.NEXT_PUBLIC_SERVER_URL);
  },
  get sepoliaRpcUrl() {
    return required("NEXT_PUBLIC_SEPOLIA_RPC_URL", process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL);
  },
  get arkivRpcUrl() {
    return required("NEXT_PUBLIC_ARKIV_RPC_URL", process.env.NEXT_PUBLIC_ARKIV_RPC_URL);
  },
  /** Not a secret: it ships in the app, locked to the site's Origins (arkiv.md). */
  get arkivAccessKey() {
    return process.env.NEXT_PUBLIC_ARKIV_ACCESS_KEY ?? "";
  },
  /** pata.eth's UserRegistry proxy, known after P0-2. */
  get pataRegistry() {
    return required("NEXT_PUBLIC_PATA_REGISTRY", process.env.NEXT_PUBLIC_PATA_REGISTRY) as `0x${string}`;
  },
  /** "1" sends writes directly instead of through Nox (P0 default; the stage switch in P1-4). */
  get directWrites() {
    return process.env.NEXT_PUBLIC_DIRECT_WRITES !== "0";
  },
};
