import { handle, ok } from "@/server/http";
import { listBundles } from "@/server/services/catalog";

export const GET = handle(async () => ok({ bundles: await listBundles() }));
