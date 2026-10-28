export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return <header className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row"><div>{eyebrow && <p className="mb-1 text-sm font-bold uppercase tracking-wider text-green-700 dark:text-green-400">{eyebrow}</p>}<h1 className="text-2xl font-black tracking-tight sm:text-3xl">{title}</h1>{description && <p className="mt-1 max-w-2xl text-sm text-slate-600 sm:text-base dark:text-slate-300">{description}</p>}</div>{action}</header>;
}
