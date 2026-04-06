import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const db = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await db
      .from("user_profiles")
      .select("return_address")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("[user/get-address] supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ returnAddress: data?.return_address ?? null });
  } catch (err) {
    console.error("[user/get-address] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
