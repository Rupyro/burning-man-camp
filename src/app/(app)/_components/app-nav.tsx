import { Bell, CheckSquare, FolderKanban, Home, Settings } from "lucide-react";
import Link from "next/link";
import { hasTradition } from "@/lib/camp";
import { Wordmark } from "../../_components/brand";
import { ModuleIcon } from "../../_components/module-icon";

export interface NavLink {
  href: string;
  label: string;
}

/** Bottom tab bar (Home, Tasks, Alerts); My profile is only the avatar top right (spec B3.2). Members keep it everywhere; leads get the sidebar from md up. */
export function TabBar({ unread, everywhere }: { unread: number; everywhere: boolean }) {
  const tabs = [
    { href: "/", label: "Home", Icon: Home },
    { href: "/tasks", label: "Tasks", Icon: CheckSquare },
    { href: "/notifications", label: unread ? `Alerts (${unread})` : "Alerts", Icon: Bell },
  ];
  return (
    <nav
      aria-label="Tabs"
      className={`fixed inset-x-0 bottom-0 z-20 flex justify-around bg-tabbar pt-2 backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))] text-tabbar-foreground ${everywhere ? "" : "md:hidden"}`}
    >
      {tabs.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          className="flex min-h-11 min-w-16 flex-col items-center text-[11px]"
        >
          <Icon aria-hidden className="size-5" />
          {label}
        </Link>
      ))}
    </nav>
  );
}

/** Laptop: left sidebar with work links, module links and admin links the caller may open. */
export function Sidebar(p: {
  work: NavLink[];
  modules: { href: string; label: string; icon: string }[];
  admin: NavLink[];
}) {
  const item = "flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm hover:bg-sidebar-accent";
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-5 overflow-y-auto bg-sidebar p-4 text-sidebar-foreground lg:flex">
      <Link href="/" className="text-sidebar-primary">
        <Wordmark className="text-3xl" />
      </Link>
      <nav aria-label="Main" className="flex flex-col gap-1">
        <Link href="/" className={item}>
          <Home aria-hidden className="size-4" /> Home
        </Link>
        {p.work.map((l) => (
          <Link key={l.href} href={l.href} className={item}>
            {l.href === "/projects" ? <FolderKanban aria-hidden className="size-4" /> : null}
            {l.label}
          </Link>
        ))}
      </nav>
      {p.modules.length ? (
        <nav aria-label="Modules" className="flex flex-col gap-1">
          <p className="px-3 text-[10px] opacity-90">Modules</p>
          {p.modules.map((m) => (
            <Link key={m.href} href={m.href} className={item}>
              <ModuleIcon name={m.icon} className="size-4" /> {m.label}
            </Link>
          ))}
        </nav>
      ) : null}
      {p.admin.length ? (
        <nav aria-label="Admin" className="flex flex-col gap-1">
          <p className="px-3 text-[10px] opacity-90">Admin</p>
          {p.admin.map((l) => (
            <Link key={l.href} href={l.href} className={item}>
              {l.label}
            </Link>
          ))}
        </nav>
      ) : null}
      <Link
        href="/me/settings"
        className="mt-auto flex items-center gap-2 px-3 py-2 text-sm opacity-90"
      >
        <Settings aria-hidden className="size-4" />
        Settings
      </Link>
      {/* Placeholder until Remo sends the camp's rain-dance artwork. A camp tradition: on when
          camp.config.ts extras.traditions has "rain-dance". */}
      {hasTradition("rain-dance") && (
        <div
          role="img"
          aria-label="Rain dance artwork coming soon"
          className="flex h-12 items-center justify-center rounded-xl border border-dashed border-sidebar-primary/50 px-2 text-center text-[10px] text-sidebar-primary opacity-80"
        >
          Rain dance artwork coming soon
        </div>
      )}
    </aside>
  );
}
