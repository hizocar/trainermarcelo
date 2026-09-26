import { leerProveedores } from '@/lib/proveedores';
import SignupForm from './SignupForm';

export const metadata = { title: 'Crea tu cuenta de coach' };

// Registro propio de COACH (v49). La web es solo para coaches: sin elegir plan
// —la prueba de 3 meses parte sola; el plan se elige al terminarla—.
// Los enlaces viejos con ?plan=… siguen llegando acá y se ignoran.
export default async function SignupPage() {
  const proveedores = await leerProveedores();
  return <SignupForm google={proveedores.google} verificaCorreo={proveedores.verificaCorreo} />;
}
