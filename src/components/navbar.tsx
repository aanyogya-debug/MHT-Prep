"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore, type AuthUser } from "@/store/auth";

export function Navbar({ user }: { user: AuthUser }) {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <nav className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80 sm:px-6">
      <Link href="/" className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <GraduationCap className="size-4.5" />
        </span>
        <span className="font-heading text-base font-semibold tracking-tight">MHT Prep</span>
      </Link>
      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 sm:flex">
          <span className="text-sm font-medium">{user.name}</span>
          <Badge variant="secondary">{user.role === "ADMIN" ? "Admin" : "Siswa"}</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="size-4" />
          <span className="hidden sm:inline">Keluar</span>
        </Button>
      </div>
    </nav>
  );
}
