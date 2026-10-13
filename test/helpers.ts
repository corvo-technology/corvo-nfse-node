export const API_KEY = `corvo_test_${"a".repeat(40)}`;
export const BASE_URL = "http://localhost:4000";

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
	const headers = new Headers(init.headers);
	if (!headers.has("content-type")) headers.set("content-type", "application/json");
	return new Response(JSON.stringify(body), { status: 200, ...init, headers });
}
