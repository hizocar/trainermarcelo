import PanelRail from '@/components/PanelRail';

// Layout del panel del coach: el riel de navegación persistente a la
// izquierda (abajo en pantallas angostas). El grupo (panel) no cambia
// ninguna URL — solo cuelga este layout sobre las rutas del panel.

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* aplica el tema guardado ANTES del primer pintado: sin parpadeo */}
      <script
        dangerouslySetInnerHTML={{
          __html: "try{var t=localStorage.getItem('panel-tema');if(t&&t!=='carbon')document.documentElement.setAttribute('data-tema',t)}catch(e){}",
        }}
      />
      <PanelRail />
      <div className="panel-main">{children}</div>
    </>
  );
}
