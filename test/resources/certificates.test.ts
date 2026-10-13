import { describe, expect, it } from "vitest";
import { Corvo } from "../../src/client";
import { API_KEY, BASE_URL, jsonResponse } from "../helpers";

const certificate = {
	id: "c31423a7-5b38-4484-9d8e-5a32ed06c273",
	companyId: "09947127-2702-4f6d-9da8-cb463608d812",
	serialNumber: "4110E41673C4EAF733414F606495301C93930A2A",
	issuer: "C=BR, CN=Empresa Exemplo TESTE",
	subject: "C=BR, CN=Empresa Exemplo TESTE",
	fingerprint: "2E484E4202B25B2B5FA0F71133475C917355FE1E",
	validFrom: "2026-01-01T00:00:00.000Z",
	validUntil: "2027-01-01T00:00:00.000Z",
	status: "active",
	createdAt: "2026-10-12T13:04:40.230Z",
};

function client(fetch: (url: string, init?: RequestInit) => Promise<Response>): Corvo {
	return new Corvo({ apiKey: API_KEY, baseUrl: BASE_URL, fetch });
}

describe("certificates", () => {
	it("upload POSTs multipart with file and password fields", async () => {
		const calls: Array<{ url: string; init: RequestInit }> = [];
		const corvo = client(async (url, init) => {
			calls.push({ url, init: init ?? {} });
			return jsonResponse({ data: certificate }, { status: 201 });
		});
		const res = await corvo.certificates.upload(certificate.companyId, {
			file: Buffer.from([1, 2, 3]),
			fileName: "certificado.p12",
			password: "Teste123!",
		});
		expect(res.error).toBeUndefined();
		expect(res.data?.id).toBe(certificate.id);
		expect(calls[0].url).toBe(
			"http://localhost:4000/v1/companies/09947127-2702-4f6d-9da8-cb463608d812/certificates",
		);
		expect(calls[0].init.method).toBe("POST");
		const form = calls[0].init.body as FormData;
		expect(form).toBeInstanceOf(FormData);
		expect(form.get("password")).toBe("Teste123!");
		const file = form.get("file") as File;
		expect(file.name).toBe("certificado.p12");
	});

	it("list returns Paginated with plain items", async () => {
		const corvo = client(async () =>
			jsonResponse({
				data: [certificate],
				pagination: { limit: 50, hasMore: false, nextCursor: null },
			}),
		);
		const res = await corvo.certificates.list(certificate.companyId);
		expect(res.error).toBeUndefined();
		expect(res.data?.data[0].fingerprint).toBe(certificate.fingerprint);
		expect(res.data?.pagination.hasMore).toBe(false);
	});

	it("remove DELETEs and resolves 204 to null", async () => {
		const urls: string[] = [];
		const corvo = client(async (url) => {
			urls.push(url);
			return new Response(null, { status: 204 });
		});
		const res = await corvo.certificates.remove(certificate.companyId, certificate.id);
		expect(res.error).toBeUndefined();
		expect(res.data).toBeNull();
		expect(urls[0]).toBe(
			"http://localhost:4000/v1/companies/09947127-2702-4f6d-9da8-cb463608d812/certificates/c31423a7-5b38-4484-9d8e-5a32ed06c273",
		);
	});
});
