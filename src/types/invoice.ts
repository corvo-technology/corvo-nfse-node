export type InvoiceStatus =
	| "queued"
	| "processing"
	| "authorized"
	| "rejected"
	| "retry_pending"
	| "reconciliation_required"
	| "manual_review"
	| "failed";

export type InvoiceStage = "pending" | "authorized" | "documents_ready" | "completed" | "failed";

export interface InvoiceCustomerInput {
	name: string;
	taxId: string;
	email?: string;
	address?: {
		street?: string;
		city?: string;
		state?: string;
		zip?: string;
		country?: string;
	};
}

export interface InvoiceCreateParams {
	companyId?: string;
	companyTaxId?: string;
	externalId?: string;
	correlationId?: string;
	customer: InvoiceCustomerInput;
	service: {
		code: string;
		municipalityCode?: string;
		description?: string;
	};
	amount: number;
	competenceDate: string;
	email?: string;
	options?: {
		email?: { send?: boolean };
	};
}

export interface Invoice {
	id: string;
	companyId: string;
	tenantId: string;
	environment: "test" | "live";
	documentKeyVersion: number;
	emailSnapshot: { send: boolean };
	externalId: string | null;
	idempotencyKey: string | null;
	status: InvoiceStatus;
	customerSnapshot: {
		name: string;
		email?: string;
		taxId?: string;
		address?: { street?: string; city?: string; state?: string; zip?: string; country?: string };
	};
	serviceSnapshot: { code?: string; description?: string; municipalityCode?: string };
	taxSnapshot: Record<string, unknown>;
	amount: number;
	currency: string;
	competenceDate: string;
	dpsId: string | null;
	dpsSeries: string | null;
	dpsNumber: number | null;
	accessKey: string | null;
	nfseNumber: number | null;
	fiscalProvider: string | null;
	fiscalSchemaVersion: string | null;
	issuedAt: string | null;
	authorizedAt: string | null;
	lastErrorCode: string | null;
	lastErrorMessage: string | null;
	lastErrorProvider: string | null;
	documentsReadyAt: string | null;
	lastEmailStatus: string | null;
	lastEmailSentAt: string | null;
	createdAt: string;
	updatedAt: string;
	documentsStatus: string;
	emailStatus: string | null;
	stage: InvoiceStage;
}

export interface InvoiceEvent {
	id: string;
	invoiceId: string;
	fromStatus: InvoiceStatus | null;
	toStatus: InvoiceStatus;
	reason: string | null;
	createdAt: string;
}

export interface InvoiceListParams {
	companyId?: string;
	status?: InvoiceStatus;
	from?: string;
	to?: string;
	externalId?: string;
	limit?: number;
	cursor?: string;
}

export interface InvoiceDownloadUrl {
	downloadUrl: string;
	expiresAt: string;
	fileName: string;
	mimeType: string;
}

export interface InvoiceEmailResult {
	emailId: string;
	status: string;
}
