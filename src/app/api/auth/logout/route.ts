import { handle, noContent } from "@/server/http";
import { logout } from "@/server/services/auth";

export const POST = handle(async () => {
  await logout();
  return noContent();
});
