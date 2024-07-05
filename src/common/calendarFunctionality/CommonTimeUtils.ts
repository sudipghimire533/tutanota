import { DateTime, FixedOffsetZone, IANAZone } from "luxon"
import { DAY_IN_MILLIS } from "@tutao/tutanota-utils"

export function getTimeZone(): string {
	return DateTime.local().zoneName
}

/**
 * the time in ms that element ids for calendar events and alarms  get randomized by
 */
export const DAYS_SHIFTED_MS = 15 * DAY_IN_MILLIS

/** get the start of the next full half hour from the time this is called at */
export function getNextHalfHour(): Date {
	let date: Date = new Date()

	if (date.getMinutes() > 30) {
		date.setHours(date.getHours() + 1, 0)
	} else {
		date.setMinutes(30)
	}

	date.setMilliseconds(0)
	return date
}

export function getValidTimeZone(zone: string, fallback?: string): string {
	if (IANAZone.isValidZone(zone)) {
		return zone
	} else {
		if (fallback && IANAZone.isValidZone(fallback)) {
			console.warn(`Time zone ${zone} is not valid, falling back to ${fallback}`)
			return fallback
		} else {
			const actualFallback = FixedOffsetZone.instance(new Date().getTimezoneOffset()).name
			console.warn(`Fallback time zone ${zone} is not valid, falling back to ${actualFallback}`)
			return actualFallback
		}
	}
}
