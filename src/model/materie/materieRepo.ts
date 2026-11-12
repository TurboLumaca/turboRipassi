/**
 * Model layer — data access for the materie.
 *
 * Same shape as `ripassiRepo`: an interface the Controller depends on, one
 * default implementation against Supabase. Ownership columns are never sent:
 * Postgres fills them from the session.
 */
import { supabase } from "@/config/supabase";
import type { Materia } from "../types";

export interface NuovaMateria {
  /**
   * Nasce sul dispositivo, come ogni altro id dell'app: un insert che si
   * nomina da sé si può ritentare senza creare due volte la stessa materia.
   */
  id: string;
  nome: string;
  colore: string;
}

export interface MaterieRepo {
  /** Tutte le materie dell'account. L'ordine lo decide la View. */
  leggi(): Promise<Materia[]>;
  crea(input: NuovaMateria): Promise<Materia>;
}

export const materieRepo: MaterieRepo = {
  async leggi(): Promise<Materia[]> {
    const { data, error } = await supabase.from("materie").select("*");
    if (error) throw error;
    return (data ?? []) as Materia[];
  },

  async crea(input): Promise<Materia> {
    const { data, error } = await supabase
      .from("materie")
      .insert({ id: input.id, nome: input.nome, colore: input.colore })
      .select()
      .single();
    if (error) throw error;
    return data as Materia;
  },
};
