// app/layout.tsx (Next.js 13+)
import "@/styles/globals.css";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/Toaster";
import { Providers } from "@/components/Providers";
import { cn } from "@/lib/utils";
import { validateEnv } from '@/lib/env';

// Validate environment variables at startup
validateEnv();

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="antialiased">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body className={cn(
        inter.className,
        "min-h-screen bg-white dark:bg-[#0a0d13] text-foreground",
        "overflow-hidden"
      )}>
        <Providers>
          <main className="h-screen">
            {children}
          </main>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}