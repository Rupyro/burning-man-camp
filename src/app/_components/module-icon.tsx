import { icons, type LucideProps } from "lucide-react";

const toPascal = (name: string) =>
  name.replace(/(^|-)([a-z0-9])/g, (_, __, c: string) => c.toUpperCase());

/** Render a lucide icon by its kebab-case name from a manifest ("calendar-check"). */
export function ModuleIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = icons[toPascal(name) as keyof typeof icons] ?? icons.Box;
  return <Icon aria-hidden {...props} />;
}
