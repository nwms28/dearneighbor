import { currentUser } from "@clerk/nextjs/server";
import { Playfair_Display, DM_Sans } from "next/font/google";
import { UserButton } from "@clerk/nextjs";

const playfair = Playfair_Display({ subsets: ["latin"] });
const dmSans = DM_Sans({ subsets: ["latin"] });

export default async function DashboardPage() {
  const user = await currentUser();

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "#0f1f3d", fontFamily: dmSans.style.fontFamily }}
    >
      {/* Nav */}
      <header
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: "rgba(201, 168, 76, 0.2)" }}
      >
        <span
          className="text-xl font-bold tracking-tight"
          style={{ color: "#c9a84c", fontFamily: playfair.style.fontFamily }}
        >
          Dear · Neighbor
        </span>
        <UserButton />
      </header>

      {/* Content */}
      <main className="flex flex-col items-center justify-center px-6 py-24 text-center">
        <p
          className="text-sm font-medium tracking-widest uppercase mb-6"
          style={{ color: "#c9a84c" }}
        >
          Dashboard
        </p>
        <h1
          className="text-4xl md:text-5xl font-semibold text-white mb-4"
          style={{ fontFamily: playfair.style.fontFamily }}
        >
          Welcome back{user?.firstName ? `, ${user.firstName}` : ""}.
        </h1>
        <p className="text-lg max-w-md" style={{ color: "#94a3b8" }}>
          Your campaign dashboard is coming soon. You&apos;ll be able to target
          neighborhoods, compose your letter, and track deliveries — all in one
          place.
        </p>

        {/* Placeholder card */}
        <div
          className="mt-12 rounded-xl p-8 w-full max-w-sm text-left"
          style={{
            backgroundColor: "rgba(201, 168, 76, 0.08)",
            border: "1px solid rgba(201, 168, 76, 0.2)",
          }}
        >
          <p
            className="text-xs font-medium tracking-widest uppercase mb-2"
            style={{ color: "#c9a84c" }}
          >
            Active campaigns
          </p>
          <p className="text-3xl font-semibold text-white">0</p>
          <p className="text-sm mt-1" style={{ color: "#64748b" }}>
            Start your first campaign to reach homeowners before they list.
          </p>
        </div>
      </main>
    </div>
  );
}
