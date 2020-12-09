import { Stop, Trip, StopTime } from '../interfaces';
import { stop, trip, stopTime } from '../uri';
import { notFound } from '../utils';

export interface LatLngBounds {
	southwest: GeoJSON.Position
	northeast: GeoJSON.Position
}

interface LatLng {
	lat: number
	lng: number
}
interface ReverseGeocodingResult {
	address_components: {
		long_name: string
		short_name: string
		types: string[]
	}[],
	formatted_address: string,
	geometry: {
		location: LatLng,
		location_type: 'ROOFTOP'|'RANGE_INTERPOLATED'|'GEOMETRIC_CENTER'|'APPROXIMATE',
		viewport: {
			northeast: LatLng
			southwest: LatLng
		},
	},
	place_id: string
	types: string[]
}
interface ReverseGeocodingResponse {
	results: ReverseGeocodingResult[]
}

/**
 * Returns the _id property of a stop document based on the
 * stop_id. Should only be used internally.
 */
export function getStopDocumentID(
	db: PouchDB.Database<Stop>,
): (stop_id: string) => Promise<string> {
	return async stopID => {
		const { rows } = await db.allDocs({
			limit: 1,
			startkey: `stop/${stopID}/`,
			endkey: `stop/${stopID}/\uffff`
		});

		if (rows.length === 0) throw notFound('missing');

		return rows[0].id;
	}
}

/**
 * Returns the location of a stop from the database as a GeoJSON coordinate
 */
export function getStopCoordinates(
	db: PouchDB.Database<Stop>,
): (stop_id: string) => Promise<[number, number]> {
	return async stopID => {
		const docID = await getStopDocumentID(db)(stopID);

		const stopInfo = stop(docID);
		return [
			parseFloat(stopInfo.stop_lon),
			parseFloat(stopInfo.stop_lat)
		];
	}
}

/**
 * Looks up the address for a stop using Google Reverse Geocoding
 */
export function stopAddress(apiKey: string): (stop: Stop) => Promise<string> {
	return async stop => {
		const latlng = `${stop.stop_lat},${stop.stop_lon}`;
		const url = 'https://maps.googleapis.com/maps/api/geocode/json';

		try {
			const res = await fetch(`${url}?latlng=${latlng}&key=${apiKey}`);
			const { results } = <ReverseGeocodingResponse> await res.json();

			const [first] = results;
			if (!first) {
				console.warn(`No address found for stop ${stop.stop_id}`);
				return '';
			} else {
				return first.formatted_address;
			}
		} catch (err) {
			console.error(err);
			return '';
		}
	}
}

/**
 * Returns the nearest stop to some position. Optionally, a maximum distance
 * from the position can be specified. Maximum distance is set in the same
 * units as latitude and longitude.
 */
export function nearestStop(
	db: PouchDB.Database<Stop>,
): (pos: GeoJSON.Position) => Promise<Stop>
export function nearestStop(
	db: PouchDB.Database<Stop>,
	maxDistance: number,
): (pos: GeoJSON.Position) => Promise<Stop|null>
export function nearestStop(
	db: PouchDB.Database<Stop>,
	maxDistance: number = Number.POSITIVE_INFINITY,
): (pos: GeoJSON.Position) => Promise<Stop|null> {
	const maxDistSquared = Math.pow(maxDistance, 2);
	return async pos => {
		let closestDistanceSqr = Number.POSITIVE_INFINITY;
		let closestStopID: string = '';
		const [lng, lat] = pos;

		const stops = await db.allDocs();
		for (const { id } of stops.rows) {
			const { stop_lat, stop_lon } = stop(id);
			// Use pythagorean formula to compute distance.
			// Use squared distances to skip calculating the square root.
			const aSqr = Math.pow(lat - parseFloat(stop_lat), 2);
			const bSqr = Math.pow(lng - parseFloat(stop_lon), 2);

			const distanceSqr = aSqr + bSqr;
			if (distanceSqr < closestDistanceSqr) {
				closestStopID = id;
				closestDistanceSqr = distanceSqr;
			}
		}

		if (maxDistSquared >= closestDistanceSqr) return db.get(closestStopID);
		else return null;
	}
}

/**
 * Returns the stop as a GeoJSON point.
 */
export function stopAsGeoJSON(stop: Stop): GeoJSON.Feature<GeoJSON.Point> {
	return {
		type: 'Feature',
		geometry: {
			type: 'Point',
			coordinates: [stop.stop_lon, stop.stop_lat]
		},
		id: stop.stop_id,
		properties: {
			stop_code: stop.stop_code,
			stop_name: stop.stop_name,
			stop_desc: stop.stop_desc,
			stop_url: stop.stop_url,
			location_type: stop.location_type,
			parent_station: stop.parent_station,
			wheelchair_boarding: stop.wheelchair_boarding,
		},
	};
}

/**
 * Returns every stop as a GeoJSON point. No properties are set on the resulting
 * features, instead only the position and id are set.
 * Internally, the stop id and position are indexed, so these points can be
 * generated without loading the entire stop database.
 */
export function allStopsAsGeoJSON(
	db: PouchDB.Database<Stop>,
): (bounds?: LatLngBounds) => Promise<GeoJSON.FeatureCollection<GeoJSON.Point>> {
	/**
	 * @param bounds If set, the stops returned are limited to a certain area
	 */
	return async bounds => {
		const stops = await db.allDocs();

		let points = stops.rows.map(s => {
			const { stop_id, stop_lat, stop_lon } = stop(s.id);
			return {
				type: 'Feature',
				geometry: {
					type: 'Point',
					coordinates: [parseFloat(stop_lon), parseFloat(stop_lat)]
				},
				id: stop_id,
				properties: null,
			} as GeoJSON.Feature<GeoJSON.Point>;
		});

		if (bounds) {
			const { northeast, southwest } = bounds;
			points = points.filter(point => {
				const [lng, lat] = point.geometry.coordinates;
				return lat <= northeast[1] && lat >= southwest[1]
					&& lng <= northeast[0] && lng >= southwest[0];
			});
		}

		return {
			type: 'FeatureCollection',
			features: points,
		};
	}
}

/**
 * Returns the stop ID of every stop in a route
 */
export function allStopsInRoute(
	tripDB: PouchDB.Database<Trip>,
	stopTimeDB: PouchDB.Database<StopTime>,
): (route_id: string) => Promise<string[]> {
	return async routeID => {
		const trips = await tripDB.allDocs({
			startkey: `trip/${routeID}/`,
			endkey: `trip/${routeID}/\uffff`,
		});

		const stopTimeRows = await Promise.all(trips.rows.map(row => {
			const tripID = trip(row.id).trip_id;
			return stopTimeDB.allDocs({
				startkey: `time/${tripID}/`,
				endkey: `time/${tripID}/\uffff`,
			});
		}));

		let stopIDs = new Set<string>();
		stopTimeRows.forEach(res =>
			res.rows.forEach(row => stopIDs.add(stopTime(row.id).stop_id))
		);

		return Array.from(stopIDs);
	}
}
