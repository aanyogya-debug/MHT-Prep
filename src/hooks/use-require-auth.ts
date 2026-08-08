"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
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

export function useRequireAuth() {
  const router = useRouter();
  const mounted = useHasMounted();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (mounted && !token) {
      router.replace("/login");
    }
  }, [mounted, token, router]);

  return {
    user,
    token,
    isReady: mounted && !!token,
  };
}
