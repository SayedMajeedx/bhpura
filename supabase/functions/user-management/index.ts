import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create admin client with service role key
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    // Create user client to verify the caller's identity
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Verify the caller is authenticated
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: invalid session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // "ensure-profile" action is allowed for any authenticated user
    if (action === "ensure-profile") {
      const body = await req.json();
      return await handleEnsureProfile(supabase, user.id, body.email || user.email);
    }

    // All other actions require admin role
    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role, status, email")
      .eq("id", user.id)
      .maybeSingle();

    // If no profile exists, treat user as admin (first user fallback)
    const callerRole: string = callerProfile?.role || "admin";
    const isAdmin = callerRole === "admin" || callerRole === "super_admin";
    const isSuperAdmin = callerRole === "super_admin" ||
      (callerProfile?.email || "").toLowerCase() === "majeed@hotmail.it";
    const isActive = !callerProfile || callerProfile.status === "active";

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Forbidden: admin role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!isActive) {
      return new Response(
        JSON.stringify({ error: "Forbidden: account inactive or suspended" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callerCtx = { userId: user.id, isSuperAdmin };

    // Handle different actions
    switch (action) {
      case "list": {
        return await handleList(supabase);
      }

      case "create": {
        const body = await req.json();
        return await handleCreate(supabase, body, callerCtx);
      }

      case "update": {
        const body = await req.json();
        return await handleUpdate(supabase, body, callerCtx);
      }

      case "delete": {
        const body = await req.json();
        return await handleDelete(supabase, body, callerCtx);
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action. Use: list, create, update, delete, ensure-profile" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (err) {

    console.error("[user-management] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleEnsureProfile(supabase: any, userId: string, email: string) {
  // Check if profile already exists
  const { data: existing, error: checkError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (checkError) {
    return new Response(
      JSON.stringify({ error: checkError.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (existing) {
    return new Response(
      JSON.stringify({ profile: existing }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Create profile for user - first user becomes admin
  const { count, error: countError } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });

  if (countError) {
    console.error("[user-management] Count error:", countError);
  }

  const role = (count ?? 0) === 0 ? "admin" : "staff";

  const { data: newProfile, error: insertError } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      email,
      name: email.split("@")[0],
      role,
      status: "active",
    })
    .select()
    .single();

  if (insertError) {
    return new Response(
      JSON.stringify({ error: insertError.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ profile: newProfile }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleList(supabase: any) {
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, email, name, role, status, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ profiles }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleCreate(supabase: any, body: any, ctx: { userId: string; isSuperAdmin: boolean }) {
  const { email, name, role, password } = body;

  if (!email || !password) {
    return new Response(
      JSON.stringify({ error: "Email and password are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const userRole = role || "staff";
  const validRoles = ctx.isSuperAdmin ? ["super_admin", "admin", "staff"] : ["admin", "staff"];
  if (!validRoles.includes(userRole)) {
    return new Response(
      JSON.stringify({ error: `Invalid role. Allowed: ${validRoles.join(", ")}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: name || email.split("@")[0] },
  });

  if (authError) {
    return new Response(
      JSON.stringify({ error: authError.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const userId = authData.user?.id;
  if (!userId) {
    return new Response(
      JSON.stringify({ error: "Failed to create user: no user ID returned" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Wait for trigger to create profile, then set desired role
  await new Promise((r) => setTimeout(r, 400));

  const { error: profileUpdateError } = await supabase
    .from("profiles")
    .update({ name: name || email.split("@")[0], role: userRole })
    .eq("id", userId);

  if (profileUpdateError) {
    console.error("[user-management] Profile update error:", profileUpdateError);
  }

  return new Response(
    JSON.stringify({
      success: true,
      user: {
        id: userId,
        email,
        name: name || email.split("@")[0],
        role: userRole,
        status: "active",
      },
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleUpdate(supabase: any, body: any, ctx: { userId: string; isSuperAdmin: boolean }) {
  const { userId, role, status, name } = body;

  if (!userId) {
    return new Response(
      JSON.stringify({ error: "userId is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Look up target to enforce super admin protection
  const { data: target } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", userId)
    .maybeSingle();

  const targetIsSuperAdmin = target?.role === "super_admin" ||
    (target?.email || "").toLowerCase() === "majeed@hotmail.it";

  if (targetIsSuperAdmin && !ctx.isSuperAdmin) {
    return new Response(
      JSON.stringify({ error: "Only a super admin can modify a super admin" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const validRoles = ctx.isSuperAdmin ? ["super_admin", "admin", "staff"] : ["admin", "staff"];

  const updates: Record<string, any> = {};
  if (role !== undefined) {
    if (!validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: `Invalid role. Allowed: ${validRoles.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    updates.role = role;
  }
  if (status !== undefined) {
    if (!["active", "inactive"].includes(status)) {
      return new Response(
        JSON.stringify({ error: "Invalid status. Must be 'active' or 'inactive'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    updates.status = status;
  }
  if (name !== undefined) {
    updates.name = name;
  }

  if (Object.keys(updates).length === 0) {
    return new Response(
      JSON.stringify({ error: "No fields to update" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId);

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (status === "inactive") {
    try { await supabase.auth.admin.signOut(userId, "global"); } catch (_) {}
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleDelete(supabase: any, body: any, ctx: { userId: string; isSuperAdmin: boolean }) {
  const { userId } = body;

  if (!userId) {
    return new Response(
      JSON.stringify({ error: "userId is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (userId === ctx.userId) {
    return new Response(
      JSON.stringify({ error: "You cannot delete your own account" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data: target } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", userId)
    .maybeSingle();

  const targetEmail = (target?.email || "").toLowerCase();
  if (targetEmail === "majeed@hotmail.it") {
    return new Response(
      JSON.stringify({ error: "The primary super admin cannot be deleted" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  if (target?.role === "super_admin" && !ctx.isSuperAdmin) {
    return new Response(
      JSON.stringify({ error: "Only a super admin can delete a super admin" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { error } = await supabase.auth.admin.deleteUser(userId);

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

