export type TaxRegime = "MEI" | "Simples Nacional" | "Lucro Presumido" | "Lucro Real";

export interface CompanyAddressInput {
	street: string;
	number?: string;
	complement?: string;
	district: string;
	city: string;
	state: string;
	zip: string;
}

export interface CompanyCreateParams {
	legalName: string;
	taxId: string;
	taxRegime: TaxRegime;
	tradeName?: string;
	municipalReg?: string;
	municipalityCode?: string;
	simpleNational?: boolean;
	specialRegime?: string;
	address?: CompanyAddressInput;
}

export interface CompanyUpdateParams {
	legalName?: string;
	tradeName?: string;
	municipalReg?: string | null;
	municipalityCode?: string;
	taxRegime?: TaxRegime;
	simpleNational?: boolean;
	specialRegime?: string;
	address?: CompanyAddressInput | null;
}

export interface Company {
	id: string;
	tenantId: string;
	legalName: string;
	tradeName: string | null;
	taxId: string;
	municipalReg: string | null;
	municipalityCode: string | null;
	taxRegime: TaxRegime;
	simpleNational: boolean;
	specialRegime: string | null;
	addressStreet: string | null;
	addressNumber: string | null;
	addressComplement: string | null;
	addressDistrict: string | null;
	addressCity: string;
	addressState: string;
	addressZip: string;
	fiscalSchemaVersion: string;
	environment: "test" | "live";
	status: string;
	createdAt: string;
	updatedAt: string;
	deletedAt: string | null;
	setupGaps: string[];
}
