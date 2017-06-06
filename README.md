# gtfs-to-pouch
Tools to query data from GTFS schedules using PouchDB databases.

Most of the functions follow a pattern where the function is called like
```ts
const agency = await getAgency(agencyDB)(id);
```
In this example, the call to `getAgency(agencyDB)` returns a function, which
is then immediately called with the `id` parameter. The second function returns
a promise, which resolves when the information is loaded from a database.

In general, databases are passed inside the first function, and ids are passed
in the second.

## Agency
```ts
function getAgency(
	db: PouchDB.Database<Agency>
): (agency_id?: string) => Promise<Agency>
```
Gets an agency from the schedule, or the first listed agency if no ID is
used. Since most schedules have only 1 agency without an agency_id property,
this function will return that agency.

## Calendar Dates
```ts
function getCalendarDate(
	db: PouchDB.Database<CalendarDate>
): (service_id: string, date: string | moment.Moment) => Promise<CalendarDate>
```
Gets a specific calendar date object from the database
- **date**: Either a moment, or a string in the YYYYMMDD format.

```ts
function allExceptions(
	db: PouchDB.Database<CalendarDate>
): (service_id: string) => Promise<CalendarDate[]>
```
Returns every exception for the given service ID

```ts
function upcomingExceptions(
	db: PouchDB.Database<CalendarDate>
): (service_id: string, duration?: Duration, now?: Moment) => Promise<CalendarDate[]>
```
Returns exceptions for the following month, or a custom duration instead.
- **duration**: A moment duration, defaults to 1 month.
- **now**: The current time. Can be overriden.


## Calendar
```ts
function calendarEntryToDays(cal: Calendar): Set<Weekdays>
```
Get the dates of service for a given calendar entry as a set of integers.
0 represents Sunday, 1 is Monday, etc.

```ts
function getDays(
	db: PouchDB.Database<Calendar>
): (service_id: string) => Promise<Set<Weekdays>>
```
Wraps `calendarEntryToDays` by looking up the calendar entry for a service ID

```ts
function dateRangeString(
	days: Set<Weekdays>,
	mode?: 'normal' | 'short' | 'min',
): string
```
Returns a string representing days of service, such as 'Daily' or 'Mon - Fri'
- **days**: Set of days in the week that are serviced by the route
- **mode**: Determins the format of the returned day names.
  * normal: Sunday, Monday, ...
  * short: Sun, Mon, ...
  * min: Su, Mo, ...

## Routes
```ts
function getRouteName(route: Route): string
```
Returns the name string from the route. route_long_name is preferred,
and route_short_name is used as a fallback

```ts
function getRoute(
	db: PouchDB.Database<Route>
): (route_id: string) => Promise<Route>
```
Get a route based on its `route_id`, which is different from the `_id`
used in the database

```ts
function listRoutes(
	db: PouchDB.Database<Route>
): () => Promise<Route[]>
```
Get every single route

```ts
function connectedRoutes(
	stopTimesDB: PouchDB.Database<StopTime>,
	tripsDB: PouchDB.Database<Trip>,
	routesDB: PouchDB.Database<Route>,
): (stop_id: string) => Promise<Route[]>
```
Get every route that connects to a given stop

```ts
function routeDays(
	tripDB: PouchDB.Database<Trip>,
	calendarDB: PouchDB.Database<Calendar>,
): (route_id: string) => Promise<Set<Weekdays>>
```
Returns all days of the week that a route is active on


## Shapes
```ts
function getShapePoint(
	db: PouchDB.Database<Shape>
): (shape_id: string, shape_pt_sequence: number) => Promise<Shape>
```
Returns a specific point in a shape

```ts
function getAllPoints(
	db: PouchDB.Database<Shape>
): (shape_id: string) => Promise<Shape[]>
```
Returns every point in a shape, sorted by their shape_pt_sequence

```ts
function shapeAsGeoJSON(shape: Shape[]): GeoJSON.Feature<GeoJSON.LineString>
```
Converts a series of shape point into a GeoJSON line string.
The shape array should be sorted and all belong to the same shape_id


## Stop Times
```ts
function getStopTime(
	db: PouchDB.Database<StopTime>
): (trip_id: string, stop_id: string, stop_sequence: number) => Promise<StopTime>
```
Gets a stop time from the database

```ts
function getTripSchedule(
	stopTimeDB: PouchDB.Database<StopTime>
): (trip_id: string) => Promise<StopTime[]>
```
Get the stop times associated with a trip, sorted by stop_sequence.
Throws 404 error if no schedule is found.

```ts
function stopTimesForStop(
	stopTimeDB: PouchDB.Database<StopTime>
): (stop_id: string) => Promise<StopTime[]>
```
Returns stop times associated to a stop

```ts
function firstAndLastStop(
	db: PouchDB.Database<StopTime>
): (trip_id: string) => Promise<{ first_stop_id: string, last_stop_id: string }>
```
Returns the first and last stop in a trip's schedule.
Throws if there is no schedule for the trip.

```ts
function nextStopFromList(
  stopTimes: StopTime[],
  now?: moment.Moment
): StopTime
```
Returns the next stop that will be reached based on a list of stop times.
Throws if the list is empty.

```ts
function nextStopOfTrip(
	db: PouchDB.Database<StopTime>
): (trip_id: string, now?: moment.Moment) => Promise<StopTime>
```

```ts
function nextStopOfRoute(
	tripDB: PouchDB.Database<Trip>,
	stopTimeDB: PouchDB.Database<StopTime>,
): (route_id: string, now?: moment.Moment) => Promise<StopTime>
```

## Stops
```ts
function getStop(
	db: PouchDB.Database<Stop>,
): (stop_id: string) => Promise<Stop>
```
Returns a stop from the database

```ts
function stopAddress(apiKey: string): (stop: Stop) => Promise<string>
```
Looks up the address for a stop using Google Reverse Geocoding
- **apiKey**: API key for Google API

```ts
function nearestStop(
	db: PouchDB.Database<Stop>,
): (pos: GeoJSON.Position) => Promise<Stop>
function nearestStop(
	db: PouchDB.Database<Stop>,
	maxDistance: number,
): (pos: GeoJSON.Position) => Promise<Stop|null>
```
Returns the nearest stop to some position. Optionally, a maximum distance
from the position can be specified. Maximum distance is set in the same
units as latitude and longitude.

```ts
function stopAsGeoJSON(stop: Stop): GeoJSON.Feature<GeoJSON.Point>
```
Returns the stop as a GeoJSON point.

```ts
interface LatLngBounds { southwest: GeoJSON.Position, northeast: GeoJSON.Position }
function allStopsAsGeoJSON(
	db: PouchDB.Database<Stop>,
): (bounds?: LatLngBounds) => Promise<GeoJSON.FeatureCollection<GeoJSON.Point>>
```
Returns every stop as a GeoJSON point. No properties are set on the resulting
features, instead only the position and id are set.
Internally, the stop id and position are indexed, so these points can be
generated without loading the entire stop database.
- **bounds**: If set, the stops returned are limited to a certain area.


## Trips
```ts
function getTrip(
	tripDB: PouchDB.Database<Trip>
): (trip_id: string, route_id?: string) => Promise<Trip>
```
Get a trip based on its `trip_id`, which is different from the `_id`
used in the database. Providing a `route_id` will speed up the lookup.

```ts
function tripName(trip: Trip): string
```
Returns the name of the trip. Uses trip_short_name or trip_headsign,
and returns an empty string if neither are avaliable

```ts
function allTripsForRoute(
	tripDB: PouchDB.Database<Trip>
): (route_id: string) => Promise<Trip[]>
```
Get every single trip that is a child of a route

```ts
function tripTimes(
	stopTimeDB: PouchDB.Database<StopTime>,
): (trip_id: string) => Promise<moment.Range>
```
Finds the earliest and latest time in the trip's schedule and returns
an array representing a range. If the schedule is empty, null is
returned instead.

```ts
function currentTrip(
	tripDB: PouchDB.Database<Trip>,
	stopTimeDB: PouchDB.Database<StopTime>,
): (route_id: string, now?: moment.Moment) => Promise<Trip>
```
Gets the trip that is currently running in a route. If none are running,
the first trip is returned instead. If some are running, the earliest current
trip is returned.

```ts
function siblingTrips(
	tripDB: PouchDB.Database<Trip>,
	stopTimeDB: PouchDB.Database<StopTime>,
): (trip: Trip) => Promise<{ previous: Trip|null, following: Trip|null }>
```
Gets the previous and following trips in this trip's route;
that is, the trip that took place immediately before and immediately after.


# GTFS object interfaces
Typescript interfaces are also exported under `'gtfs-to-pouch/dist/interfaces'`.
