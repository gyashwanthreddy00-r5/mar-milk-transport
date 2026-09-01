import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hashCode(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizePhone(phone: string): string {
  let p = phone.trim().replace(/\s+/g, "");
  if (!p.startsWith("+")) {
    if (p.startsWith("91") && p.length === 12) {
      p = "+" + p;
    } else if (p.length === 10) {
      p = "+91" + p;
    } else {
      p = "+" + p;
    }
  }
  return p;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { action, caller_id, target_user_id, full_name, phone, password, role } = await req.json();

    if (!caller_id) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Verify caller is admin
    const { data: caller, error: callerError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", caller_id)
      .maybeSingle();

    if (callerError || !caller || caller.role !== "admin") {
      return jsonResponse({ error: "Admin access required" }, 403);
    }

    // CREATE: create a new auth user + profile with phone and password
    if (action === "create") {
      if (!full_name || !phone || !password) {
        return jsonResponse({ error: "Name, mobile number, and password are required" }, 400);
      }
      if (password.length < 4) {
        return jsonResponse({ error: "Password must be at least 4 characters" }, 400);
      }

      const normalizedPhone = normalizePhone(String(phone));
      if (!/^\+\d{10,15}$/.test(normalizedPhone)) {
        return jsonResponse({ error: "Please enter a valid mobile number" }, 400);
      }

      // Check if phone already exists
      const last10 = normalizedPhone.replace(/\D/g, "").slice(-10);
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .ilike("phone", `%${last10}`)
        .limit(1)
        .maybeSingle();

      if (existing) {
        return jsonResponse({ error: "A user with this mobile number already exists" }, 409);
      }

      // Generate a unique email (Supabase auth requires email, but we use phone for login)
      const generatedEmail = `user_${Date.now()}@mar-erp.local`;

      // Create auth user
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: generatedEmail,
        email_confirm: true,
        user_metadata: {
          full_name: String(full_name),
          phone: normalizedPhone,
        },
      });

      if (authError || !authUser.user) {
        return jsonResponse({ error: "Could not create user: " + (authError?.message || "unknown") }, 500);
      }

      // Set password hash on profile
      const passwordHash = await hashCode(String(password));
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          phone: normalizedPhone,
          password_hash: passwordHash,
          full_name: String(full_name),
          role: role || "staff",
        })
        .eq("id", authUser.user.id);

      if (profileError) {
        return jsonResponse({ error: "User created but profile setup failed" }, 500);
      }

      return jsonResponse({ success: true, user_id: authUser.user.id });
    }

    // RESET PASSWORD: set a new password for an existing user
    if (action === "reset_password") {
      if (!target_user_id || !password) {
        return jsonResponse({ error: "User and new password are required" }, 400);
      }
      if (password.length < 4) {
        return jsonResponse({ error: "Password must be at least 4 characters" }, 400);
      }

      const passwordHash = await hashCode(String(password));
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ password_hash: passwordHash })
        .eq("id", target_user_id);

      if (updateError) {
        return jsonResponse({ error: "Could not reset password" }, 500);
      }

      return jsonResponse({ success: true });
    }

    // SET PHONE: update phone number for a user
    if (action === "set_phone") {
      if (!target_user_id || !phone) {
        return jsonResponse({ error: "User and mobile number are required" }, 400);
      }

      const normalizedPhone = normalizePhone(String(phone));
      if (!/^\+\d{10,15}$/.test(normalizedPhone)) {
        return jsonResponse({ error: "Please enter a valid mobile number" }, 400);
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ phone: normalizedPhone })
        .eq("id", target_user_id);

      if (updateError) {
        return jsonResponse({ error: "Could not update mobile number" }, 500);
      }

      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch {
    return jsonResponse({ error: "Unable to process request" }, 500);
  }
});


