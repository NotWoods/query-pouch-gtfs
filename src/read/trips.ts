import * as moment from 'moment';
import { extendMoment, DateRange } from 'moment-range';
import { trip } from '../uri';
import { Trip, StopTime } from '../interfaces';
import { getTripSchedule, scheduleRange } from './stop_times';
import { extractDocs, removeItem, timeOnly, notFound } from '../utils';

extendMoment(moment);

/**
 * Returns the name of the trip. Uses trip_short_name or trip_headsign,
 * and returns an empty string if neither are avaliable
 */
export function tripName(trip: Trip): string {
	return trip.trip_short_name || trip.trip_headsign || '';
}

/**
 * Get every single trip that is a child of a route
 */
export function allTripsForRoute(
	tripDB: PouchDB.Database<Trip>
): (route_id: string) => Promise<Trip[]> {
	return async routeID => {
		const trips = await tripDB.allDocs({
			startkey: `trip/${routeID}/`,
			endkey: `trip/${routeID}/\uffff`,
			include_docs: true,
		});

		return extractDocs(trips);
	}
}

/**
 * Finds the earliest and latest time in the trip's schedule and returns
 * a moment range.
 */
export function tripTimes(
	stopTimeDB: PouchDB.Database<StopTime>,
): (trip_id: string) => Promise<DateRange> {
	return async id => scheduleRange(await getTripSchedule(stopTimeDB)(id));
}

/**
 * Gets the trip that is currently running in a route. If none are running,
 * the first trip is returned instead. If some are running, the earliest current
 * trip is returned.
 */
export function currentTrip(
	tripDB: PouchDB.Database<Trip>,
	stopTimeDB: PouchDB.Database<StopTime>,
): (route_id: string, now?: moment.Moment) => Promise<Trip> {
	return async (routeID, now = moment()) => {
		// Get the ID of every trip for this route
		const trips = await tripDB.allDocs({
			startkey: `trip/${routeID}/`,
			endkey: `trip/${routeID}/\uffff`,
		});

		if (trips.total_rows === 0) throw notFound('missing route');

		// Get a moment for the current time, but with a 0 date
		const nowTime = timeOnly(now);

		// Get the time range for each trip, and save it to ranges
		// if it overlaps with the current time
		const ranges: { start: moment.Moment, _id: string }[] = [];
		const _tripTimes = tripTimes(stopTimeDB);
		await Promise.all(trips.rows.map(async t => {
			const { trip_id } = trip(t.id);
			const range = await _tripTimes(trip_id);

			if (range.start <= nowTime && range.end >= nowTime) {
				ranges.push({ start: range.start, _id: t.id });
			}
		}));

		// Return the earliest trip found.
		// If none of the ranges overlap with the current time,
		// return the first trip in the route.
		let desiredID: string;
		if (ranges.length === 0) desiredID = trips.rows[0].id;
		else {
			const [earliest] = ranges.sort(
				(a, b) => a.start.valueOf() - b.start.valueOf()
			);
			desiredID = earliest._id;
		}

		return tripDB.get(desiredID);
	}
}

/**
 * Gets the previous and following trips in this trip's route;
 * that is, the trip that took place immediately before and immediately
 * after.
 */
export function siblingTrips(
	tripDB: PouchDB.Database<Trip>,
	stopTimeDB: PouchDB.Database<StopTime>,
): (trip: Trip) => Promise<{ previous: Trip|null, following: Trip|null }> {
	return async trip => {
		const [thisTripTime, allTrips] = await Promise.all([
			tripTimes(stopTimeDB)(trip.trip_id),
			allTripsForRoute(tripDB)(trip.route_id),
		]);

		// Must have some times to compare to
		if (!thisTripTime) return { previous: null, following: null };

		// Remove the passed trip from this list
		removeItem(allTrips, t => t._id === trip._id);

		// Push trips into containers based on wheter they take place
		// before the passed trip or after
		type Result = { trip: Trip, range: DateRange };
		let before: Result[] = [];
		let after: Result[] = [];
		await Promise.all(allTrips.map(async trip => {
			const range = await tripTimes(stopTimeDB)(trip.trip_id);
			if (!range) return;

			if (thisTripTime.overlaps(range)) return;
			else if (thisTripTime.start > range.end) before.push({ trip, range });
			else after.push({ trip, range });
		}));

		// Sort the arrays based on the ranges
		before.sort((a, b) => a.range.end.valueOf() - b.range.end.valueOf());
		after.sort((a, b) => a.range.start.valueOf() - b.range.start.valueOf());

		// Get the items adjacent to the passed trip
		let previous: Trip | null;
		let following: Trip | null;

		if (before.length > 0) {
			// Use the last item in the `before` list as the previous trip
			previous = before[before.length - 1].trip;
		} else {
			// If no trips take place before this one, use the last 'after' trip
			// instead. (The last trip in the previous day.)
			if (after.length > 0) previous = after[after.length - 1].trip;
			else previous = null;
		}

		if (after.length > 0) {
			// Use the first item in the `after` list as the following trip
			following = after[0].trip;
		} else {
			// If no trips take place after this one, use the first 'before' trip
			// instead. (The first trip in the next day.)
			if (before.length > 0) following = before[0].trip;
			else following = null;
		}

		return { previous, following };
	}
}
