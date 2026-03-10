import { Check, Copy, LogOut } from 'lucide-react';

interface TableHeaderProps {
  roomCode: string;
  codeCopied: boolean;
  scoreUs: number;
  scoreThem: number;
  roomLifecycle: string;
  statusTone: 'neutral' | 'warning' | 'success';
  onCopyCode: () => void;
  onLeave: () => void;
}

export function TableHeader({
  roomCode,
  codeCopied,
  scoreUs,
  scoreThem,
  roomLifecycle,
  statusTone,
  onCopyCode,
  onLeave,
}: TableHeaderProps) {
  const statusClass = statusTone === 'warning'
    ? 'border-amber-300/30 bg-amber-500/10 text-amber-200'
    : statusTone === 'success'
      ? 'border-emerald-300/25 bg-emerald-500/10 text-emerald-200'
      : 'border-white/10 bg-white/5 text-white/60';

  return (
    <header className="table-surface safe-top flex flex-wrap items-start justify-between gap-3 rounded-[28px] px-4 py-3 sm:px-5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-300/70">Truco online</p>
            <div className="mt-1 flex items-center gap-2">
              <h1 className="truncate text-[1.9rem] font-black leading-none text-white sm:text-[2.3rem]">
                Sala {roomCode}
              </h1>
              <button
                type="button"
                onClick={onCopyCode}
                title="Copiar codigo da sala"
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/65 transition hover:bg-white/10 hover:text-white"
              >
                {codeCopied ? <Check className="h-5 w-5 text-emerald-400" /> : <Copy className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex w-full items-start justify-between gap-3 sm:w-auto sm:items-center">
        <div className="grid min-w-[10rem] grid-cols-2 overflow-hidden rounded-[24px] border border-white/10 bg-black/30">
          <div className="px-4 py-3 text-center">
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/35">Nos</p>
            <p className="font-mono text-4xl font-black leading-none text-emerald-300">{scoreUs}</p>
          </div>
          <div className="border-l border-white/10 px-4 py-3 text-center">
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/35">Eles</p>
            <p className="font-mono text-4xl font-black leading-none text-rose-300">{scoreThem}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className={`rounded-2xl border px-3 py-2 text-xs font-black uppercase tracking-[0.22em] ${statusClass}`}>
            {roomLifecycle}
          </div>
          <button
            type="button"
            onClick={onLeave}
            title="Sair da sala"
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/65 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
