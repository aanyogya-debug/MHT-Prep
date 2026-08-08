"use client";

import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { user, isReady } = useRequireAuth();

  if (!isReady || !user) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar user={user} />
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-semibold">Selamat datang, {user.name}</h1>
        {user.role === "ADMIN" ? (
          <Button render={<Link href="/admin/topics" />}>Kelola Topik</Button>
        ) : (
          <p className="text-muted-foreground">Dashboard siswa belum dibangun.</p>
        )}
      </main>
    </div>
  );
}
