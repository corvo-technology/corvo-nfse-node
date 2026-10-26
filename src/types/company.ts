/** Corvo serves only these two regimes; any other value returns `422` `ERROR_TAX_REGIME_NOT_SUPPORTED`. */
export type TaxRegime = "MEI" | "Simples Nacional";

export interface CompanyAddressInput {
	street?: string;
	number?: string;
	complement?: string;
	district?: string;
	city?: string;
	/** Two-letter UF. */
	state?: string;
	/** 8 digits, with or without punctuation. */
	zip?: string;
}

export interface CompanyCreateParams {
	legalName: string;
	/** CNPJ. */
	taxId: string;
	taxRegime: TaxRegime;
	/** IBGE code of the company's city (7 digits). Required. */
	municipalityCode: string;
	tradeName?: string;
	/** Stored, but only sent on the invoice when `sendMunicipalReg` is `true`. */
	municipalReg?: string | null;
	/** Default `false`. Turn on only if the city registered the company in the national registry. */
	sendMunicipalReg?: boolean;
	/** National service code (cTribNac, 6 digits) used when an invoice omits `service.code`. */
	defaultServiceCode?: string;
	simpleNational?: boolean;
	specialRegime?: string;
	/**
	 * Required for `Simples Nacional`, ignored for `MEI`. Effective total rate (%) of your DAS, as in
	 * the PGDAS-D, e.g. `"6.54"` (0 to 100, at most 2 decimals). Goes on every invoice.
	 */
	simplesRate?: string;
	/** `Simples Nacional` only: effective ISS rate (%) of your bracket (1.80 to 5.00), needed when a customer withholds ISS. */
	simplesIssRate?: string;
	address?: CompanyAddressInput;
}

export interface CompanyUpdateParams {
	legalName?: string;
	tradeName?: string;
	municipalReg?: string | null;
	sendMunicipalReg?: boolean;
	municipalityCode?: string;
	defaultServiceCode?: string | null;
	taxRegime?: TaxRegime;
	simpleNational?: boolean;
	specialRegime?: string;
	/** Omit to keep the current value; send a new one to update it (for example, each month). Ignored for `MEI`. */
	simplesRate?: string;
	/** `null` removes it. */
	simplesIssRate?: string | null;
	address?: CompanyAddressInput | null;
}

/** Optional fields are absent from the JSON when they have no value. */
export interface Company {
	id: string;
	tenantId: string;
	legalName: string;
	tradeName?: string;
	taxId: string;
	municipalReg?: string;
	sendMunicipalReg?: boolean;
	municipalityCode?: string;
	defaultServiceCode?: string;
	taxRegime: TaxRegime | null;
	simpleNational: boolean;
	specialRegime: string | null;
	addressStreet?: string;
	addressNumber?: string;
	addressComplement?: string;
	addressDistrict?: string;
	addressCity?: string;
	addressState?: string;
	addressZip?: string;
	fiscalSchemaVersion: string;
	environment: "test" | "live";
	status: "pending_setup" | "ready" | "blocked";
	createdAt: string;
	updatedAt: string;
	deletedAt?: string;
	/** Pending setup: `municipality_code`, `certificate`. */
	setupGaps: string[];
}
