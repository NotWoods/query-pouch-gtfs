import { Shape } from '../interfaces';
import { extractDocs } from './utils';

/**
 * Returns every point in a shape, sorted by their shape_pt_sequence
 */
export function getAllPoints(
	db: PouchDB.Database<Shape>
): (shape_id: string) => Promise<Shape[]> {
	return async shapeID => {
		const shapes = await db.allDocs({
			include_docs: true,
			startkey: `shape/${shapeID}/`,
			endkey: `shape/${shapeID}/\uffff`,
		});

		return extractDocs(shapes);
	}
}

/**
 * Converts a series of shape point into a GeoJSON line string.
 * The shape array should be sorted and all belong to the same shape_id
 */
export function shapeAsGeoJSON(shape: Shape[]): GeoJSON.Feature<GeoJSON.LineString> {
	return {
		type: 'Feature',
		geometry: {
			type: 'LineString',
			coordinates: shape.map(point => [point.shape_pt_lon, point.shape_pt_lat])
		},
		properties: null,
		id: shape[0].shape_id,
	};
}
