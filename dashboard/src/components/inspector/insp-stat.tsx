interface InspStatProps {
  label: string
  children: React.ReactNode
}

export function InspStat({ label, children }: InspStatProps) {
  return (
    <div className="rounded-lg bg-bg-hover p-2.5">
      <p className="text-[11px] text-text-muted">{label}</p>
      <div className="text-[15px] font-bold text-text-primary mt-0.5">{children}</div>
    </div>
  )
}
