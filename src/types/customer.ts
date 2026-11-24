import type { CnpjProfile as CnpjProfileSchema, SavedCustomer, UpdateCustomer } from "./openapi";

export type Customer = SavedCustomer;
export type CustomerUpdateParams = UpdateCustomer;
export type CnpjProfile = CnpjProfileSchema;

export interface CustomerSearchParams {
	/** Part of the name, or the first digits of the CPF/CNPJ (punctuation is ignored). Up to 100 characters. */
	search?: string;
	limit?: number;
	/** Opaque: the offset of the next page. Pass it back untouched. */
	cursor?: string;
}
