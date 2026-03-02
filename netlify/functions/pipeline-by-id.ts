import type { Context } from "@netlify/functions";
import { supabase } from "./utils/supabase.js";

const headers = { "Content-Type": "application/json" };

export default async (req: Request, _context: Context) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id)
    return new Response(JSON.stringify({ error: "Missing id" }), {
      status: 400,
      headers,
    });

  if (req.method === "PATCH") {
    const body = await req.json();
    const { posts_per_day } = body;

    const { error } = await supabase
      .from("pipelines")
      .update({ posts_per_day })
      .eq("id", id);

    if (error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers,
      });

    return new Response(JSON.stringify({ success: true }), { headers });
  }

  if (req.method === "DELETE") {
    await supabase.from("activity_log").delete().eq("pipeline_id", id);
    const { error } = await supabase.from("pipelines").delete().eq("id", id);

    if (error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers,
      });

    return new Response(JSON.stringify({ success: true }), { headers });
  }

  return new Response("Method Not Allowed", { status: 405 });
};
