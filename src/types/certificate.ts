export interface Certificate {
	id: string;
	companyId: string;
	serialNumber: string;
	issuer: string;
	subject: string;
	fingerprint: string;
	validFrom: string;
	validUntil: string;
	status: string;
	createdAt: string;
}

export interface CertificateUploadParams {
	file: Buffer | Uint8Array;
	fileName?: string;
	password: string;
}
