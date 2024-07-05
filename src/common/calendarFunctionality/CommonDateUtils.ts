import { DateProvider } from "../api/common/DateProvider.js"
import { getTimeZone } from "./CommonTimeUtils.js"
import { DateTime } from "luxon"
import { isValidDate } from "@tutao/tutanota-utils"

export class DefaultDateProvider implements DateProvider {
	now(): number {
		return Date.now()
	}

	timeZone(): string {
		return getTimeZone()
	}
}

/**
 * @param localDate
 * @returns {Date} a Date with a unix timestamp corresponding to 00:00 UTC for localDate's Day in the local time zone
 */
export function getAllDayDateUTC(localDate: Date): Date {
	return new Date(Date.UTC(localDate.getFullYear(), localDate.getMonth(), localDate.getDate(), 0, 0, 0, 0))
}

/**
 * @param utcDate a Date with a unix timestamp corresponding to 00:00 UTC for a given Day
 * @returns {Date} a Date with a unix timestamp corresponding to 00:00 for that day in the local time zone
 */
export function getAllDayDateLocal(utcDate: Date): Date {
	return new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate())
}

/** takes a date which encodes the day in UTC and produces a date that encodes the same date but in local time zone. All times must be 0. */
export function getAllDayDateForTimezone(utcDate: Date, zone: string): Date {
	return DateTime.fromJSDate(utcDate, { zone: "utc" })
		.setZone(zone, { keepLocalTime: true })
		.set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
		.toJSDate()
}

export function assertDateIsValid(date: Date) {
	if (!isValidDate(date)) {
		throw new Error("Date is invalid!")
	}
}
