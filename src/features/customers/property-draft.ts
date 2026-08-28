/** Rascunho do formulário de casa — tudo texto, como o navegador entrega. */
export type PropertyDraft = {
  label: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  bedrooms: string;
  bathrooms: string;
  access_notes: string;
  parking_notes: string;
};

export const EMPTY_PROPERTY: PropertyDraft = {
  label: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  postal_code: "",
  bedrooms: "",
  bathrooms: "",
  access_notes: "",
  parking_notes: "",
};

/** Converte o rascunho para o formato do banco: campo vazio vira null. */
export function toPropertyRow(draft: PropertyDraft) {
  return {
    label: draft.label || "Casa",
    address_line1: draft.address_line1,
    address_line2: draft.address_line2 || null,
    city: draft.city || null,
    state: draft.state || null,
    postal_code: draft.postal_code || null,
    bedrooms: draft.bedrooms ? Number(draft.bedrooms) : null,
    bathrooms: draft.bathrooms ? Number(draft.bathrooms) : null,
    access_notes: draft.access_notes || null,
    parking_notes: draft.parking_notes || null,
    square_feet: null,
  };
}
