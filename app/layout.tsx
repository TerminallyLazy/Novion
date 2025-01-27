// app/layout.tsx (Next.js 13+)
import "@/styles/globals.css";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/Toaster";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="dark antialiased">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body className={cn(
        inter.className,
        "min-h-screen bg-background text-foreground",
        "overflow-hidden"
      )}>
        <main className="h-screen">
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  );
}