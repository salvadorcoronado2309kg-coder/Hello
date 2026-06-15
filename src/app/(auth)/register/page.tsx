'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { RegimenITBIS } from '@/types';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [rncCedula, setRncCedula] = useState('');
  const [regimenITBIS, setRegimenITBIS] = useState<RegimenITBIS>(RegimenITBIS.GRAVADO_TOTAL);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (rncCedula.length < 9 || rncCedula.length > 11) {
      setError('El RNC/Cédula debe tener entre 9 y 11 caracteres.');
      return;
    }
    if (!/^\d+$/.test(rncCedula)) {
      setError('El RNC/Cédula debe contener solo dígitos.');
      return;
    }

    setCargando(true);

    try {
      const supabase = createClient();

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          setError('Este correo electrónico ya está registrado.');
        } else {
          setError(authError.message);
        }
        return;
      }

      if (authData.user) {
        const { error: clienteError } = await supabase.from('clientes').insert({
          id: authData.user.id,
          razon_social: razonSocial,
          rnc_cedula: rncCedula,
          regimen_itbis: regimenITBIS,
          activo: true,
        });

        if (clienteError) {
          console.error('Error al crear cliente:', clienteError);
          setError('Usuario creado pero hubo un error al guardar los datos de empresa. Contacte soporte.');
          return;
        }
      }

      setExito(true);
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch {
      setError('Ocurrió un error inesperado. Por favor intente de nuevo.');
    } finally {
      setCargando(false);
    }
  };

  if (exito) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Registro Exitoso</h2>
          <p className="text-sm text-gray-600 mb-4">
            Su cuenta ha sido creada. Por favor revise su correo electrónico para confirmar su cuenta.
          </p>
          <p className="text-xs text-gray-400">Redirigiendo al inicio de sesión...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4 shadow-lg">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Form 606 DGII</h1>
          <p className="text-sm text-gray-500 mt-1">Sistema de Gestión Fiscal</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Crear Cuenta</h2>

          {error && (
            <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2">
                <label htmlFor="razonSocial" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Razón Social / Nombre Empresa
                </label>
                <input
                  id="razonSocial"
                  type="text"
                  value={razonSocial}
                  onChange={(e) => setRazonSocial(e.target.value)}
                  required
                  placeholder="Empresa S.R.L."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                />
              </div>

              <div>
                <label htmlFor="rncCedula" className="block text-sm font-medium text-gray-700 mb-1.5">
                  RNC / Cédula (9–11 dígitos)
                </label>
                <input
                  id="rncCedula"
                  type="text"
                  value={rncCedula}
                  onChange={(e) => setRncCedula(e.target.value.replace(/\D/g, ''))}
                  required
                  placeholder="123456789"
                  maxLength={11}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                />
              </div>

              <div>
                <label htmlFor="regimenITBIS" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Régimen ITBIS
                </label>
                <select
                  id="regimenITBIS"
                  value={regimenITBIS}
                  onChange={(e) => setRegimenITBIS(e.target.value as RegimenITBIS)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition bg-white"
                >
                  <option value={RegimenITBIS.EXENTO}>Exento</option>
                  <option value={RegimenITBIS.GRAVADO_TOTAL}>Gravado Total</option>
                  <option value={RegimenITBIS.PROPORCIONAL}>Proporcional</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Correo Electrónico
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="correo@empresa.com"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Confirmar Contraseña
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="Repita la contraseña"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={cargando}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-lg text-sm transition shadow-sm"
            >
              {cargando ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creando cuenta...
                </span>
              ) : (
                'Crear Cuenta'
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            ¿Ya tiene una cuenta?{' '}
            <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
              Inicie sesión aquí
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          República Dominicana · DGII · Conforme a NG-07-2018
        </p>
      </div>
    </div>
  );
}
