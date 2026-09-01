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

    const { phone, password } = await req.json();

    if (!phone || !password) {
      return jsonResponse({ error: "Mobile number and password are required" }, 400);
    }

    const normalizedPhone = normalizePhone(String(phone));

    if (!/^\+\d{10,15}$/.test(normalizedPhone)) {
      return jsonResponse({ error: "Please enter a valid mobile number" }, 400);
    }

    // Look up profile by phone number — match on last 10 digits
    const last10 = normalizedPhone.replace(/\D/g, "").slice(-10);
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, phone, password_hash, full_name, role, language")
      .ilike("phone", `%${last10}`)
      .limit(1)
      .maybeSingle();

    if (profileError || !profile) {
      return jsonResponse({ error: "No account found with this mobile number" }, 404);
    }

    if (!profile.password_hash) {
      return jsonResponse({ error: "Password not set. Contact your administrator." }, 403);
    }

    // Verify password
    const computedHash = await hashCode(String(password));
    if (computedHash !== profile.password_hash) {
      return jsonResponse({ error: "Incorrect password" }, 401);
    }

    // Sync the password to the Supabase auth account so the client can
    // sign in with email + password directly (no magic link needed)
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      profile.id,
      { password: String(password) },
    );

    if (updateError) {
      return jsonResponse({ error: "Could not sign you in. Please try again." }, 500);
    }

    return jsonResponse({
      success: true,
      email: profile.email,
    });
  } catch {
    return jsonResponse({ error: "Unable to process request. Please try again." }, 500);
  }
});
