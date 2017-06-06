/**
 * Converts a result from `db.allDocs` to an array of documents, skipping
 * any delelted or errored documents
 */
export default function extractDocs<T>(
	result: PouchDB.Core.AllDocsResponse<T>
): T[] {
	return result.rows.reduce((docs, row) => {
		if (row.doc) docs.push(row.doc);
		return docs;
	}, [] as T[]);
}
