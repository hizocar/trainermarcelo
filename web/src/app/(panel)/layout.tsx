import PanelRail from '@/components/PanelRail';

// Layout del panel del coach: el riel de navegación persistente a la
// izquierda (abajo en pantallas angostas). El grupo (panel) no cambia
// ninguna URL — solo cuelga este layout sobre las rutas del panel.

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PanelRail />
      <div className="panel-main">{children}</div>
    </>
  );
}
