import Image from 'next/image';

interface Props {
  /** ruta pública de la captura, p. ej. "/capturas/panel.png" */
  src: string;
  /** qué muestra la pantalla, para quien no ve la imagen */
  alt: string;
  width: number;
  height: number;
}

/**
 * Captura del panel web, que es apaisada y no cabe en un marco de teléfono.
 *
 * El marco es el mismo que el de PhoneFrame pero sin las esquinas redondeadas
 * de un móvil: lo que se está mostrando es una ventana de computador, y fingir
 * que es un teléfono confundiría justo en la sección que explica que el coach
 * trabaja desde el escritorio.
 */
export default function WideShot({ src, alt, width, height }: Props) {
  return (
    <div className="wide-frame">
      <Image src={src} alt={alt} width={width} height={height} sizes="(max-width: 720px) 92vw, 560px" className="wide-shot" />
    </div>
  );
}
