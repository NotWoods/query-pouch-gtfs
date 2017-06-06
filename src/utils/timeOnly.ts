import * as moment from 'moment';

/**
 * Sets the date of a moment to zero, leaving only the hour and
 * smaller units
 */
export default function timeOnly(base: moment.Moment): moment.Moment {
	return moment(0).set({
		hour: base.hour(),
		minute: base.minute(),
		second: base.second(),
		millisecond: base.millisecond(),
	});
}
