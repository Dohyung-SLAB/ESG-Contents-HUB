import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseEnv } from "@/lib/supabase/env";

/**
 * Service-role client for server scripts / privileged server actions.
 * Never import this into client components.
 */
export function createSupabaseAdminClient(): SupabaseClient {
  const { url, serviceRoleKey } = getSupabaseEnv();
  if (!serviceRoleKey || serviceRoleKey.includes("your-service-role")) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY가 없습니다. .env.local에 service_role 키를 추가하세요.",
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
