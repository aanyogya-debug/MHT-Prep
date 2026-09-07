"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import { Users, BookOpen, ClipboardList, Upload, Dumbbell, Timer, ArrowRight } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { useRequireAuth } from "@/hooks/use-require-auth";

interface ActionCard {
  href: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}

const ADMIN_CARDS: ActionCard[] = [
  {
    href: "/admin/students",
    title: "Progres Siswa",
    description: "Pantau skor, mastery, dan riwayat latihan",
    icon: Users,
  },
  {
    href: "/admin/topics",
    title: "Kelola Topik",
    description: "Materi, soal, dan learning path per topik",
    icon: BookOpen,
  },
  {
    href: "/admin/tryouts",
    title: "Kelola Tryout",
    description: "Generate simulasi 100 soal",
    icon: ClipboardList,
  },
  {
    href: "/admin/import",
    title: "Import Soal",
    description: "Unggah bank soal massal dari Excel",
    icon: Upload,
  },
];

const STUDENT_CARDS: ActionCard[] = [
  {
    href: "/practice",
    title: "Latihan per Subbab",
    description: "Kerjakan soal per subbab, langsung dengan pembahasan",
    icon: Dumbbell,
  },
  {
    href: "/tryouts",
    title: "Tryout",
    description: "Simulasi ujian penuh, 100 soal 200 menit",
    icon: Timer,
  },
];

function ActionCardLink({ href, title, description, icon: Icon }: ActionCard) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-xl border bg-card p-4 text-left ring-1 ring-foreground/10 transition-all hover:-translate-y-0.5 hover:shadow-md hover:ring-primary/30"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <span className="flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}

export default function Home() {
  const { user, isReady } = useRequireAuth();

  if (!isReady || !user) {
    return null;
  }

  const cards = user.role === "ADMIN" ? ADMIN_CARDS : STUDENT_CARDS;

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <Navbar user={user} />
      <main className="mx-auto w-full max-w-2xl flex-1 p-6">
        <div className="mt-4 mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Halo, {user.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {user.role === "ADMIN"
              ? "Apa yang mau dikelola hari ini?"
              : "Yuk lanjutkan persiapan ujianmu."}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {cards.map((card) => (
            <ActionCardLink key={card.href} {...card} />
          ))}
        </div>
      </main>
    </div>
  );
}
