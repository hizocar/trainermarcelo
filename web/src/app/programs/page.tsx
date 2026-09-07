import Link from 'next/link';
import Logo from '@/components/Logo';
import NewProgramButton from './NewProgramButton';
import ProgramCatalog, { type ProgramaCard } from './ProgramCatalog';
import { requireCoach } from '@/lib/guard';

export const dynamic = 'force-dynamic';

export default async function ProgramsPage() {
  const { supabase, userId } = await requireCoach();

  const { data: templates } = await supabase
    .from('program_templates')
    .select('id, name, created_at, duration_weeks, level, focus, program_template_days(id)')
    .eq('coach_id', userId)
    .order('created_at', { ascending: false });

  const programas: ProgramaCard[] = (templates ?? []).map((t: any) => ({
    id: t.id,
    name: t.name,
    days: t.program_template_days?.length ?? 0,
    weeks: t.duration_weeks ?? null,
    level: t.level ?? null,
    focus: t.focus ?? null,
  }));

  return (
    <>
      <header className="app-header">
        <div className="container inner">
          <Link href="/dashboard" className="brand">
            <Logo />
          </Link>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/library" className="btn btn-ghost" style={{ padding: '10px 18px' }}>BIBLIOTECA</Link>
            <Link href="/dashboard" className="btn btn-ghost" style={{ padding: '10px 18px' }}>← CLIENTES</Link>
          </div>
        </div>
      </header>

      <main className="container" style={{ paddingTop: 34, paddingBottom: 60 }}>
        <span className="label accent">Programas</span>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 className="display" style={{ fontSize: 40 }}>Programas</h1>
            <p className="muted" style={{ marginTop: 4 }}>
              Arma un split completo sin necesidad de tener un cliente todavía — después lo asignas a uno o varios.
            </p>
          </div>
          <NewProgramButton />
        </div>

        <ProgramCatalog programas={programas} />
      </main>
    </>
  );
}
