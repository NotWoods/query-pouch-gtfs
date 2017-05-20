import * as moment from 'moment';
import { trip } from '../dump/transformers'
import { StopTime, Trip } from '../interfaces';
import { extractDocs } from './utils';

/**
 * Get the stop times associated with a trip
 */
export function getTripSchedule(
	stopTimeDB: PouchDB.Database<StopTime>
): (trip_id: string) => Promise<StopTime[]> {
	return async tripID => {
		const times = await stopTimeDB.allDocs({
			include_docs: true,
			startkey: `time/${tripID}/`,
			endkey: `time/${tripID}/\uffff`,
		});

		return extractDocs(times);
	}
}

export type FirstLastResult = { first_stop_id: string, last_stop_id: string };

/**
 * Returns the first and last stop in a trip's schedule.
 * Returns null if there is no schedule for the trip.
 */
export function firstAndLastStop(
	db: PouchDB.Database<StopTime>
): (trip_id: string) => Promise<FirstLastResult|null> {
	return async tripID => {
		const times = await db.allDocs({
			startkey: `time/${tripID}/`,
			endkey: `time/${tripID}/\uffff`,
		});

		// Sort the IDs by stop sequence
		const ids = times.rows
			.filter(row => !row.value.deleted)
			.map(row => row.id)
			.sort();

		// If the schedule is empty, return null.
		if (ids.length === 0) return null;

		const firstID = ids[0];
		const lastID = ids[ids.length - 1];
		const [first, last] = await Promise.all([
			db.get(firstID), db.get(lastID)
		]);

		return {
			first_stop_id: first.stop_id,
			last_stop_id: last.stop_id,
		};
	}
}

/**
 * Returns the next stop that will be reached based on a
 * list of stop times
 */
export function nextStopFromList(
	stopTimes: StopTime[]
): (now?: moment.Moment) => Promise<StopTime|null> {
	return async (now = moment()) => {
		const nowTime = moment(0).set({
			hour: now.hour(),
			minute: now.minute(),
			second: now.second(),
			millisecond: now.millisecond(),
		})

		let closestStop: StopTime|null = null;
		for (const stopTime of stopTimes) {
			const time = moment(stopTime.arrival_time, 'H:mm:ss');
			if (time < nowTime) continue;

			if (!closestStop) closestStop = stopTime;
			else if (time < moment(closestStop.arrival_time)) closestStop = stopTime;
		}

		return closestStop;
	}
}

export function nextStopOfTrip(
	db: PouchDB.Database<StopTime>
): (trip_id: string, now?: moment.Moment) => Promise<StopTime|null> {
	return async (tripID, now) => {
		const list = await getTripSchedule(db)(tripID);
		return nextStopFromList(list)(now);
	}
}

export function nextStopOfRoute(
	tripDB: PouchDB.Database<Trip>,
	stopTimeDB: PouchDB.Database<StopTime>,
): (route_id: string, now?: moment.Moment) => Promise<StopTime|null> {
	return async (routeID, now) => {
		const allTrips = await tripDB.allDocs();

		const desiredTrips = allTrips.rows
			.filter(row => trip(row.id).route_id === routeID)
			.map(row => trip(row.id).trip_id);

		const getSchedule = getTripSchedule(stopTimeDB);
		let schedules: StopTime[] = [];
		await Promise.all(desiredTrips.map(async trip_id => {
			const subSchedule = await getSchedule(trip_id);
			schedules.push(...subSchedule);
		}));

		return nextStopFromList(schedules)(now);
	}
}
