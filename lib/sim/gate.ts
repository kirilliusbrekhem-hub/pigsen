import "server-only";
import { requireApiUser } from "@/lib/api/http";
import { requireUser, type CurrentUser } from "@/lib/auth/session";

// The simulator is open to every logged-in user; Free/Pro run limits live in the service.
export async function requireSimApiUser(): Promise<CurrentUser> {
  return requireApiUser();
}

export async function requireSimPageUser(): Promise<CurrentUser> {
  return requireUser();
}
