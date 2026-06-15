import { createClient } from '@/lib/supabase';
import { Cliente, CreateClienteDTO, UpdateClienteDTO, RegimenITBIS } from '@/types';

function mapearCliente(row: Record<string, unknown>): Cliente {
  return {
    id: row.id as string,
    razonSocial: row.razon_social as string,
    rncCedula: row.rnc_cedula as string,
    regimenITBIS: row.regimen_itbis as RegimenITBIS,
    fechaCreacion: new Date(row.fecha_creacion as string),
    fechaActualizacion: new Date(row.fecha_actualizacion as string),
    activo: row.activo as boolean,
  };
}

export class ClienteService {
  private supabase = createClient();

  async listar(): Promise<Cliente[]> {
    const { data, error } = await this.supabase
      .from('clientes')
      .select('*')
      .eq('activo', true)
      .order('razon_social');
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapearCliente);
  }

  async obtener(id: string): Promise<Cliente | null> {
    const { data, error } = await this.supabase
      .from('clientes')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return mapearCliente(data);
  }

  async crear(dto: CreateClienteDTO): Promise<Cliente> {
    const { data, error } = await this.supabase
      .from('clientes')
      .insert({
        razon_social: dto.razonSocial,
        rnc_cedula: dto.rncCedula,
        regimen_itbis: dto.regimenITBIS,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapearCliente(data);
  }

  async actualizar(id: string, dto: UpdateClienteDTO): Promise<Cliente> {
    const updates: Record<string, unknown> = {};
    if (dto.razonSocial !== undefined) updates.razon_social = dto.razonSocial;
    if (dto.regimenITBIS !== undefined) updates.regimen_itbis = dto.regimenITBIS;
    if (dto.activo !== undefined) updates.activo = dto.activo;

    const { data, error } = await this.supabase
      .from('clientes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapearCliente(data);
  }

  async desactivar(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('clientes')
      .update({ activo: false })
      .eq('id', id);
    if (error) throw new Error(error.message);
  }
}

export const clienteService = new ClienteService();
