// Template (no layout): se remonta en CADA navegación, y con eso el contenido
// entra con un respiro de 6px en vez de aparecer de golpe tras el esqueleto.
// 220ms y sutil a propósito: la navegación del panel es de decenas de veces al
// día — a esa frecuencia el movimiento debe rozar lo imperceptible.

export default function PanelTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
