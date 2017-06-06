/**
 * Removes an item from an array
 * @param array array that will be changed
 * @param func the first item that returns true will be removed
 */
export default function removeItem<T>(array: T[], func: (T) => boolean): void {
	const index = array.findIndex(func);
	if (index === -1) return;
	array.splice(index, 1);
}
