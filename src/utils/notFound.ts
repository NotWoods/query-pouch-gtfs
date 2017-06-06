export default function notFound(message: string) {
	return { status: 404, name: 'not_found', message };
}
