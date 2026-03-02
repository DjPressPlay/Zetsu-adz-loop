import type { Context } from "@netlify/functions";
import { supabase } from "./utils/supabase.js";

const headers = { "Content-Type": "application/json" };

export default async (req: Request, _context: Context) => {
  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("activity_log")
      .select(
        `
        *,
        pipelines (
          name,
          platform
        )
      `
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers,
      });

    const flattenedLogs = (data || []).map((l) => ({
      ...l,
      pipeline_name: l.pipelines?.name,
      platform: l.pipelines?.platform,
    }));

    return new Response(JSON.stringify(flattenedLogs), { headers });
  }

  if (req.method === "POST") {
    const body = await req.json();
    const { pipeline_id, type, message, metadata } = body;

    const { error } = await supabase
      .from("activity_log")
      .insert([{ pipeline_id, type, message, metadata }]);

    if (error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers,
      });

    if (type === "POSTING") {
      const { data: pipeline } = await supabase
        .from("pipelines")
        .select("posts_completed")
        .eq("id", pipeline_id)
        .single();

      await supabase
        .from("pipelines")
        .update({
          posts_completed: (pipeline?.posts_completed || 0) + 1,
          last_run: new Date().toISOString(),
        })
        .eq("id", pipeline_id);
    }

    return new Response(JSON.stringify({ success: true }), { headers });
  }

  return new Response("Method Not Allowed", { status: 405 });
};
