import { Dumbbell } from '@/components/Logo';

// Esqueleto del panel: aparece EN EL INSTANTE del clic, mientras el servidor
// junta los datos. Antes no había nada — el clic se sentía muerto hasta que
// llegaba la página entera. La marca pulsa, las barras brillan: el panel
// respira mientras carga.

export default function PanelLoading() {
  return (
    <main className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <div className="skel-brand"><Dumbbell size={30} /></div>
      <div className="skel-line" style={{ width: 120, height: 12, marginTop: 26 }} />
      <div className="skel-line" style={{ width: 300, height: 38, marginTop: 12 }} />
      <div style={{ display: 'flex', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skel-line" style={{ flex: 1, minWidth: 150, height: 84, borderRadius: 14 }} />
        ))}
      </div>
      <div style={{ display: 'grid', gap: 16, marginTop: 24, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="skel-line" style={{ height: 140, borderRadius: 18 }} />
        ))}
      </div>
    </main>
  );
}
