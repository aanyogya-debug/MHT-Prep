"use client";

import { Navbar } from "@/components/navbar";
import { useRequireAuth } from "@/hooks/use-require-auth";

export default function Home() {
  const { user, isReady } = useRequireAuth();

  if (!isReady || !user) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar user={user} />
      <main className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-semibold">Selamat datang, {user.name}</h1>
        <p className="mt-2 text-muted-foreground">
          Dashboard {user.role === "ADMIN" ? "admin" : "siswa"} belum dibangun.
        </p>
      </main>
    </div>
  );
}
