import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase-server';
import ReviewForm from './ReviewForm';

export const metadata: Metadata = {
  title: 'Deja tu comentario — EliteFitness',
};

export default async function OpinarPage({
  params,
}: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: coach, error } = await supabase
    .from('public_coaches')
    .select('slug, name')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  if (!coach) notFound();

  return (
    <div className="auth-wrap">
      <ReviewForm slug={coach.slug} coachName={coach.name} />
    </div>
  );
}
