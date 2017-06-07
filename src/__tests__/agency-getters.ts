import {
	getAgency
} from '../getters';
import * as GTFS from '../interfaces';
import { MockDB } from './mocks/DB';

let db: PouchDB.Database<GTFS.Agency>

beforeEach(() => {
	db = new MockDB('agency') as any;
})

test('retrives only doc', async () => {
	await db.bulkDocs([
		{
			_id: 'Hele-On',
			agency_name: 'Hele-On',
			agency_url: 'heleonbus.com',
			agency_timezone: 'Pacific/Honolulu'
		}
	]);

	expect(await getAgency(db)()).toEqual({
		_id: 'Hele-On',
		_rev: expect.any(String),
		agency_name: 'Hele-On',
		agency_url: 'heleonbus.com',
		agency_timezone: 'Pacific/Honolulu'
	})
})

test('retrives first doc', async () => {
	await db.bulkDocs([
		{
			_id: 'hele',
			agency_id: 'hele',
			agency_name: 'Hele-On',
			agency_url: 'heleonbus.com',
			agency_timezone: 'Pacific/Honolulu'
		},
		{
			_id: 'tl',
			agency_id: 'van',
			agency_name: 'TransLink',
			agency_url: 'translink.ca',
			agency_timezone: 'America/Vancouver'
		}
	]);

	expect(await getAgency(db)()).toEqual({
		_id: 'hele',
		_rev: expect.any(String),
		agency_id: 'hele',
		agency_name: 'Hele-On',
		agency_url: 'heleonbus.com',
		agency_timezone: 'Pacific/Honolulu'
	})
})

test('retrives specific doc if requested', async () => {
	await db.bulkDocs([
		{
			_id: 'hele',
			agency_id: 'hele',
			agency_name: 'Hele-On',
			agency_url: 'heleonbus.com',
			agency_timezone: 'Pacific/Honolulu'
		},
		{
			_id: 'tl',
			agency_id: 'van',
			agency_name: 'TransLink',
			agency_url: 'translink.ca',
			agency_timezone: 'America/Vancouver'
		}
	]);

	expect(await getAgency(db)('tl')).toEqual({
		_id: 'tl',
		_rev: expect.any(String),
		agency_id: 'van',
		agency_name: 'TransLink',
		agency_url: 'translink.ca',
		agency_timezone: 'America/Vancouver'
	})
})
