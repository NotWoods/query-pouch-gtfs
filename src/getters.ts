import * as moment from 'moment';
import {
	calendarDate,
	shapePoint,
	stopTime,
	trip,
} from './uri';
import {
	Agency, CalendarDate,
	Calendar, Route, Shape,
	StopTime, Stop, Trip,
} from './interfaces';
import { notFound } from './utils';

/**
 * Gets an agency from the schedule, or the first listed agency if no ID is
 * used. Since most schedules have only 1 agency without an agency_id property,
 * this function will return that agency.
 */
export function getAgency(
	db: PouchDB.Database<Agency>
): (agency_id?: string) => Promise<Agency> {
	return async id => {
		if (id) return db.get(id);

		const { rows } = await db.allDocs({ limit: 1, include_docs: true });
		if (rows.length === 0) throw notFound('no agencies in database');

		return rows[0].doc;
	}
}

/**
 * Looks up the calendar entry for a service ID
 */
export function getCalendarEntry(
	calDB: PouchDB.Database<Calendar>
): (service_id: string) => Promise<Calendar> {
	return serviceID => calDB.get(serviceID);
}

/**
 * Gets a specific calendar date object from the database
 */
export function getCalendarDate(
	db: PouchDB.Database<CalendarDate>
): (service_id: string, date: string | moment.Moment) => Promise<CalendarDate> {
	/** @param date Either a moment, or a string in the YYYYMMDD format */
	return (service_id, date) => {
		// Convert the moment into a date string
		if (typeof date !== 'string') {
			date = date.format('YMMDD');
		}

		return db.get(calendarDate({ service_id, date }))
	}
}

/**
 * Get a route based on its `route_id`, which is different from the `_id`
 * used in the database
 */
export function getRoute(
	db: PouchDB.Database<Route>
): (route_id: string) => Promise<Route> {
	return routeID => db.get(`route/${routeID}`)
}

/**
 * Returns a specific point in a shape
 */
export function getShapePoint(
	db: PouchDB.Database<Shape>
): (shape_id: string, shape_pt_sequence: number) => Promise<Shape> {
	return async (shape_id, sequence) => db.get(shapePoint({
		shape_id, shape_pt_sequence: String(sequence)
	}));
}

/**
 * Gets a stop time from the database
 */
export function getStopTime(
	db: PouchDB.Database<StopTime>
): (trip_id: string, stop_id: string, stop_sequence: number) => Promise<StopTime> {
	return (trip_id, stop_id, stop_sequence) => db.get(stopTime({
		trip_id,
		stop_id,
		stop_sequence: String(stop_sequence),
	}))
}

/**
 * Returns a stop from the database
 */
export function getStop(
	db: PouchDB.Database<Stop>,
): (stop_id: string) => Promise<Stop> {
	return async stopID => {
		const { rows } = await db.allDocs({
			include_docs: true,
			limit: 1,
			startkey: `stop/${stopID}/`,
			endkey: `stop/${stopID}/\uffff`
		});

		if (rows.length === 0) throw notFound('missing');

		return rows[0].doc;
	}
}

/**
 * Get a trip based on its `trip_id`, which is different from the `_id`
 * used in the database. Providing a `route_id` will speed up the lookup.
 */
export function getTrip(
	tripDB: PouchDB.Database<Trip>
): (trip_id: string, route_id?: string) => Promise<Trip> {
	return async (tripID, routeID) => {
		if (routeID) {
			// If we know the route ID, the ID is easily generated
			const { rows } = await tripDB.allDocs({
				startkey: `trip/${routeID}/${tripID}/`,
				endkey: `trip/${routeID}/${tripID}/\uffff`,
				limit: 1,
				include_docs: true,
			});

			if (rows.length === 0) throw notFound('missing');
			return rows[0].doc;
		} else {
			// Otherwise look for the specific trip in an ID list
			const trips = await tripDB.allDocs({
				startkey: 'trip/',
				endkey: 'trip/\uffff',
			});

			const desiredRow = trips.rows.find(row => trip(row.id).trip_id === tripID);
			// If not found, throw an error
			if (!desiredRow) throw notFound('missing');
			return tripDB.get(desiredRow.id);
		}
	}
}
