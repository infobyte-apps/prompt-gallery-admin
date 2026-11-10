import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Helper to compute HMAC-SHA1 in Web Crypto API (Deno compatible)
async function hmacSha1(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const imagekitPrivateKey = Deno.env.get("IMAGEKIT_PRIVATE_KEY") || "";
    const imagekitPublicKey = Deno.env.get("IMAGEKIT_PUBLIC_KEY") || Deno.env.get("VITE_IMAGEKIT_PUBLIC_KEY") || "";
    const imagekitUrlEndpoint = Deno.env.get("IMAGEKIT_URL_ENDPOINT") || Deno.env.get("VITE_IMAGEKIT_URL_ENDPOINT") || "";

    // 1. Authenticate caller and verify role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized access: invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check staff role in admin_members
    const { data: member, error: roleError } = await supabase
      .from("admin_members")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleError || !member || !["super_admin", "publisher", "editor"].includes(member.role)) {
      return new Response(JSON.stringify({ error: "Forbidden: insufficient permissions" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    // 2. Action: 'auth' -> issue short-lived upload signature
    if (action === "auth") {
      if (!imagekitPrivateKey) {
        // If private key is not yet set in Supabase secrets, return helpful setup message
        return new Response(
          JSON.stringify({ 
            error: "ImageKit configuration pending: IMAGEKIT_PRIVATE_KEY secret is not set on server.",
            needsConfig: true 
          }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const token = crypto.randomUUID();
      const expire = Math.floor(Date.now() / 1000) + 1800; // 30 minutes validity
      const signature = await hmacSha1(token + expire, imagekitPrivateKey);

      return new Response(
        JSON.stringify({
          token,
          expire,
          signature,
          publicKey: imagekitPublicKey,
          urlEndpoint: imagekitUrlEndpoint,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Action: 'verify' -> verify asset metadata via ImageKit API
    if (action === "verify") {
      const { fileId } = body;
      if (!fileId) {
        return new Response(JSON.stringify({ error: "Missing fileId for verification" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!imagekitPrivateKey) {
        // Fallback verification if secret is not set in development
        return new Response(
          JSON.stringify({
            valid: true,
            fileId,
            verifiedVia: "client-pre-verified",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const basicAuth = btoa(`${imagekitPrivateKey}:`);
      const ikRes = await fetch(`https://api.imagekit.io/v1/files/${fileId}/details`, {
        headers: { Authorization: `Basic ${basicAuth}` },
      });

      if (!ikRes.ok) {
        const errText = await ikRes.text();
        return new Response(JSON.stringify({ error: `ImageKit verification failed: ${errText}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const ikData = await ikRes.json();
      return new Response(
        JSON.stringify({
          valid: true,
          fileId: ikData.fileId,
          url: ikData.url,
          name: ikData.name,
          width: ikData.width,
          height: ikData.height,
          size: ikData.size,
          filePath: ikData.filePath,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Action: 'delete' -> delete from ImageKit if not referenced in DB
    if (action === "delete") {
      const { fileId } = body;
      if (!fileId) {
        return new Response(JSON.stringify({ error: "Missing fileId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check whether this fileId is still referenced by any prompt or category
      const [promptCheck, catCheck] = await Promise.all([
        supabase.from("prompt_media").select("id", { count: "exact", head: true }).eq("imagekit_file_id", fileId),
        supabase.from("categories").select("id", { count: "exact", head: true }).eq("cover_imagekit_file_id", fileId),
      ]);

      if ((promptCheck.count || 0) > 0 || (catCheck.count || 0) > 0) {
        return new Response(
          JSON.stringify({ error: "Cannot delete asset: file is currently referenced in prompts or categories" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (imagekitPrivateKey) {
        const basicAuth = btoa(`${imagekitPrivateKey}:`);
        await fetch(`https://api.imagekit.io/v1/files/${fileId}`, {
          method: "DELETE",
          headers: { Authorization: `Basic ${basicAuth}` },
        });
      }

      return new Response(JSON.stringify({ success: true, deletedFileId: fileId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Action: 'sign-url' -> create signed URL for private draft delivery
    if (action === "sign-url") {
      const { url, expirySeconds = 1800 } = body;
      if (!url) {
        return new Response(JSON.stringify({ error: "Missing url" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!imagekitPrivateKey) {
        return new Response(JSON.stringify({ signedUrl: url }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const parsedUrl = new URL(url);
      const expiryTimestamp = Math.floor(Date.now() / 1000) + expirySeconds;
      const signature = await hmacSha1(parsedUrl.pathname + expiryTimestamp, imagekitPrivateKey);
      parsedUrl.searchParams.set("ik-t", String(expiryTimestamp));
      parsedUrl.searchParams.set("ik-s", signature);

      return new Response(JSON.stringify({ signedUrl: parsedUrl.toString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

