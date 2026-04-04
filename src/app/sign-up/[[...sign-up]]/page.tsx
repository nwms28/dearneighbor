import { SignUp } from "@clerk/nextjs";
import { Playfair_Display } from "next/font/google";

const playfair = Playfair_Display({ subsets: ["latin"] });

export default function SignUpPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-20"
      style={{ backgroundColor: "#0f1f3d" }}
    >
      <div className="flex flex-col items-center gap-8 w-full">
        <h1
          className="text-4xl font-bold tracking-tight"
          style={{ color: "#c9a84c", fontFamily: playfair.style.fontFamily }}
        >
          Dear · Neighbor
        </h1>
        <SignUp />
      </div>
    </div>
  );
}
