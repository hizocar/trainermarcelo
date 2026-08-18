import Image from 'next/image';

interface Props {
  /** ruta pública de la captura, p. ej. "/capturas/hoy.png" */
  src: string;
  /** qué muestra la pantalla, para quien no ve la imagen */
  alt: string;
  /** true solo en la captura visible sin hacer scroll */
  priority?: boolean;
}

/**
 * Enmarca una captura de la app como pantalla de teléfono.
 *
 * Las capturas están a 662×1440 (el doble de su tamaño de presentación) para
 * que se vean nítidas en pantallas retina. El marco es sobrio a propósito: la
 * captura ya es el contenido, un marco decorado competiría con ella.
 */
export default function PhoneFrame({ src, alt, priority = false }: Props) {
  return (
    <div className="phone-frame">
      <Image
        src={src}
        alt={alt}
        width={662}
        height={1440}
        sizes="(max-width: 720px) 60vw, 300px"
        priority={priority}
        className="phone-shot"
      />
    </div>
  );
}
