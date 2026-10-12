import { describe, expect, it, vi } from "vitest";
import { CorvoApiError } from "../src/error";
import { mapPlain, mapProps } from "../src/transport";
import { API_KEY, BASE_URL, jsonResponse } from "./helpers";

interface Page {
	data: unknown[];
	pagination: { limit: number; hasMore: boolean; nextCursor: string | null };
}

describe("HttpTransport.list/iterate", () => {
	it("list returns Paginated with mapped items", async () => {
		const page: Page = {
			data: [{ id: "co_1", legalName: "ACME" }],
			pagination: { limit: 50, hasMore: false, nextCursor: null },
		};
		const fetchMock = vi.fn(async () => jsonResponse({ ...page }));
		const res = await new (await import("../src/transport")).HttpTransport({
			apiKey: API_KEY,
			baseUrl: BASE_URL,
			fetch: fetchMock,
		}).list<{ id: string }>("/companies", { limit: 50 }, mapPlain);
		expect(res.error).toBeUndefined();
		expect(res.data?.data).toEqual([{ id: "co_1", legalName: "ACME" }]);
		expect(res.data?.pagination).toEqual({ limit: 50, hasMore: false, nextCursor: null });
	});

	it("iterate walks all pages passing the cursor", async () => {
		const pages: Page[] = [
			{
				data: [{ props: { id: "inv_1" } }, { props: { id: "inv_2" } }],
				pagination: { limit: 2, hasMore: true, nextCursor: "cursor-1" },
			},
			{
				data: [{ props: { id: "inv_3" } }],
				pagination: { limit: 2, hasMore: false, nextCursor: null },
			},
		];
		const urls: string[] = [];
		let call = 0;
		const fetchMock = vi.fn(async (url: string) => {
			urls.push(url);
			return jsonResponse(pages[Math.min(call++, pages.length - 1)]);
		});
		const { HttpTransport } = await import("../src/transport");
		const http = new HttpTransport({ apiKey: API_KEY, baseUrl: BASE_URL, fetch: fetchMock });
		const ids: string[] = [];
		for await (const invoice of http.iterate(
			"/invoices",
			{ companyId: "co_1", limit: 2 },
			mapProps,
		)) {
			ids.push((invoice as { id: string }).id);
		}
		expect(ids).toEqual(["inv_1", "inv_2", "inv_3"]);
		expect(urls[0]).toContain("companyId=co_1");
		expect(urls[0]).not.toContain("cursor=");
		expect(urls[1]).toContain("cursor=cursor-1");
		expect(urls[1]).toContain("companyId=co_1");
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("iterate throws CorvoApiError when a page fails", async () => {
		let call = 0;
		const fetchMock = vi.fn(async () => {
			if (call++ === 0) {
				return jsonResponse({
					data: [{ id: "co_1" }],
					pagination: { limit: 50, hasMore: true, nextCursor: "c1" },
				});
			}
			return jsonResponse(
				{ statusCode: 500, code: "ERROR_INTERNAL", message: "boom" },
				{ status: 500 },
			);
		});
		const { HttpTransport } = await import("../src/transport");
		const http = new HttpTransport({ apiKey: API_KEY, baseUrl: BASE_URL, fetch: fetchMock });
		await expect(async () => {
			for await (const _item of http.iterate("/companies", undefined, mapPlain)) {
				// drain
			}
		}).rejects.toThrowError(CorvoApiError);
	});
});
