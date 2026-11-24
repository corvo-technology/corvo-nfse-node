import type { Certificate as CertificateSchema } from "./openapi";

export type Certificate = CertificateSchema;

export interface CertificateUploadParams {
	file: Buffer | Uint8Array;
	fileName?: string;
	password: string;
}
