import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      console.error("[campaigns/list] Supabase env vars missing");
      return NextResponse.json({ campaigns: [] });
    }

    const db = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await db
      .from("campaigns")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[campaigns/list] Supabase error:", error.message);
      return NextResponse.json({ campaigns: [] });
    }

    return NextResponse.json({ campaigns: data ?? [] });
  } catch (err) {
    console.error("[campaigns/list] unhandled error:", err);
    return NextResponse.json({ campaigns: [] });
  }
}
