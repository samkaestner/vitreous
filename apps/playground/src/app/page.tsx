import { RailDemo } from "./RailDemo";

export default function Home() {
  return (
    <div className="min-h-dvh bg-black text-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
        <header className="flex items-start justify-between gap-6">
          <div className="space-y-2">
            <div className="text-xs font-medium tracking-[0.24em] text-white/60">
              VITREOUS · PLAYGROUND
            </div>
            <h1 className="text-balance text-3xl font-semibold tracking-tight">
              AI supervision cockpit
            </h1>
            <p className="max-w-2xl text-pretty text-sm leading-6 text-white/70">
              A production-shaped demo for provenance, conflicts, approval gates,
              branches, and a persisted Vitreous event log.
            </p>
          </div>
        </header>

        <RailDemo />
      </div>
    </div>
  );
}
