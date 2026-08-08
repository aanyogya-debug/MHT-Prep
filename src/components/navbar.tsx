"use client";

import { useRouter } from "next/navigation";
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
    <nav className="flex items-center justify-between border-b px-6 py-3">
      <span className="font-heading font-medium">MHT Prep</span>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{user.name}</span>
        <Badge variant="secondary">{user.role}</Badge>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          Keluar
        </Button>
      </div>
    </nav>
  );
}
