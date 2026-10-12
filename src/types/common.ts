export interface Pagination {
	limit: number;
	hasMore: boolean;
	nextCursor: string | null;
}

export interface Paginated<T> {
	data: T[];
	pagination: Pagination;
}
