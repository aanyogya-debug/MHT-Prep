"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import { useAuthStore } from "@/store/auth";

const emptySubscribe = () => () => {};

// Auth disimpan di localStorage (bukan cookie), jadi Next.js middleware
// (server-side) tidak bisa lihatnya — proteksi route dilakukan client-side
// lewat hook ini, dipanggil di tiap halaman yang butuh login.
//
// `mounted` (via useSyncExternalStore, bukan effect+setState) menunda
// pembacaan store sampai component ter-mount di client: render pertama
// (SSR + hydration pass) harus konsisten (server tidak punya localStorage),
// baru setelah itu state persist zustand yang sudah ke-rehydrate dari
// localStorage dipakai.
function useHasMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

export function useRequireAuth(requiredRole?: Role) {
  const router = useRouter();
  const mounted = useHasMounted();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  const isAuthorized = !requiredRole || user?.role === requiredRole;

  useEffect(() => {
    if (!mounted) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    // Sudah login tapi role tidak cocok (mis. student buka halaman admin) —
    // lempar ke home, bukan /login (kredensialnya valid, cuma tidak diizinkan).
    if (!isAuthorized) {
      router.replace("/");
    }
  }, [mounted, token, isAuthorized, router]);

  return {
    user,
    token,
    isReady: mounted && !!token && isAuthorized,
  };
}
