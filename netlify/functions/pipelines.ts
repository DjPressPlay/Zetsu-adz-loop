import type { Context } from "@netlify/functions";
import { supabase } from "./utils/supabase.js";
import { encrypt } from "./utils/crypto.js";

const headers = { "Content-Type": "application/json" };

export default async (req: Request, _context: Context) => {
  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("pipelines")
      .select("*")
      .order("created_at", { ascending: false });

    if (error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers,
      });

    const masked = (data || []).map((p) => ({
      ...p,
      access_token: p.access_token ? "••••••••••••••••" : null,
    }));

    return new Response(JSON.stringify(masked), { headers });
  }

  if (req.method === "POST") {
    const body = await req.json();
    const {
      name,
      url,
      social_handle,
      platform,
      target_posts,
      access_token,
      posts_per_day,
    } = body;

    const encryptedToken = encrypt(access_token);

    const { data, error } = await supabase
      .from("pipelines")
      .insert([
        {
          name,
          url,
          social_handle,
          platform,
          target_posts,
          access_token: encryptedToken,
          posts_per_day: posts_per_day || 3,
        },
      ])
      .select();

    if (error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers,
      });

    return new Response(JSON.stringify({ id: data[0].id }), { headers });
  }

  return new Response("Method Not Allowed", { status: 405 });
};
