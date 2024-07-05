import { DateTime, DurationLikeObject } from "luxon"
import type { CalendarInfo } from "./CalendarModel.js"
import { CalendarEvent, CalendarGroupRoot, EncryptedMailAddress } from "../api/entities/tutanota/TypeRefs.js"
import { AlarmInterval, AlarmIntervalUnit, AlarmOccurrence, incrementByRepeatPeriod } from "../../calendar-app/calendar/date/CalendarUtils.js"
import { filterInt } from "@tutao/tutanota-utils"
import { EndType, RepeatPeriod } from "../api/common/TutanotaConstants.js"
import { stringToCustomId } from "../api/common/utils/EntityUtils.js"
import { ParserError } from "../misc/parsing/ParserCombinator.js"
import { DAYS_SHIFTED_MS, getNextHalfHour } from "./CommonTimeUtils.js"
import { cleanMailAddress } from "../mailFunctionality/CommonMailUtils.js"
import { assertDateIsValid, getAllDayDateForTimezone } from "./CommonDateUtils.js"

export type CalendarEventTimes = Pick<CalendarEvent, "startTime" | "endTime">

export function findPrivateCalendar(calendarInfo: ReadonlyMap<Id, CalendarInfo>): CalendarInfo | null {
	for (const calendar of calendarInfo.values()) {
		if (!calendar.shared) {
			return calendar
		}
	}

	return null
}

/*
 * convenience wrapper for isAllDayEventByTimes
 */
export function isAllDayEvent({ startTime, endTime }: CalendarEventTimes): boolean {
	return isAllDayEventByTimes(startTime, endTime)
}

/**
 * determine if an event with the given start and end times would be an all-day event
 */
export function isAllDayEventByTimes(startTime: Date, endTime: Date): boolean {
	return (
		startTime.getUTCHours() === 0 &&
		startTime.getUTCMinutes() === 0 &&
		startTime.getUTCSeconds() === 0 &&
		endTime.getUTCHours() === 0 &&
		endTime.getUTCMinutes() === 0 &&
		endTime.getUTCSeconds() === 0
	)
}

/**
 * generate a semi-randomized element id for a calendar event or an alarm
 * @param timestamp the start time of the event or the creation time of the alarm
 */
export function generateEventElementId(timestamp: number): string {
	// the id is based on either the event start time or the alarm creation time
	// we add a random shift between -DAYS_SHIFTED_MS and +DAYS_SHIFTED_MS to the event
	// id to prevent the server from knowing the exact time but still being able to
	// approximately sort them.
	const randomDay = Math.floor(Math.random() * DAYS_SHIFTED_MS) * 2
	return createEventElementId(timestamp, randomDay - DAYS_SHIFTED_MS)
}

/**
 * https://262.ecma-international.org/5.1/#sec-15.9.1.1
 * * ECMAScript Number values can represent all integers from –9,007,199,254,740,992 to 9,007,199,254,740,992
 * * The actual range of times supported by ECMAScript Date objects is slightly smaller: a range of +-8,640,000,000,000,000 milliseconds
 * -> this makes the element Id a string of between 1 and 17 number characters (the shiftDays are negligible)
 *
 * exported for testing
 * @param timestamp
 * @param shiftDays
 */
export function createEventElementId(timestamp: number, shiftDays: number): string {
	return stringToCustomId(String(timestamp + shiftDays))
}

/**
 * the maximum id an event with a given start time could have based on its
 * randomization.
 * @param timestamp
 */
export function geEventElementMaxId(timestamp: number): string {
	return createEventElementId(timestamp, DAYS_SHIFTED_MS)
}

/**
 * the minimum an event with a given start time could have based on its
 * randomization.
 * @param timestamp
 */
export function getEventElementMinId(timestamp: number): string {
	return createEventElementId(timestamp, -DAYS_SHIFTED_MS)
}

/**
 * get the first attendee from the list of attendees/guests that corresponds to one of the given recipient addresses, if there is one
 */
export function findAttendeeInAddresses<T extends { address: EncryptedMailAddress }>(attendees: ReadonlyArray<T>, addresses: ReadonlyArray<string>): T | null {
	// the filters are necessary because of #5147
	// we may get passed addresses and attendees that could not be decrypted and don't have addresses.
	const lowerCaseAddresses = addresses.filter(Boolean).map(cleanMailAddress)
	return attendees.find((a) => a.address.address != null && lowerCaseAddresses.includes(cleanMailAddress(a.address.address))) ?? null
}

/**
 * find the first of a list of recipients that have the given address assigned
 */
export function findRecipientWithAddress<T extends { address: string }>(recipients: ReadonlyArray<T>, address: string): T | null {
	const cleanAddress = cleanMailAddress(address)
	return recipients.find((r) => cleanMailAddress(r.address) === cleanAddress) ?? null
}

/**
 * get a partial calendar event with start time set to the passed value
 * (year, day, hours and minutes. seconds and milliseconds are zeroed.)
 * and an end time 30 minutes later than that.
 * @param startDate the start time to use for the event (defaults to the next full half hour)
 */
export function getEventWithDefaultTimes(startDate: Date = getNextHalfHour()): CalendarEventTimes {
	let endDate = new Date(startDate)
	return {
		startTime: new Date(startDate),
		endTime: new Date(endDate.setMinutes(endDate.getMinutes() + 30)),
	}
}

export function getEventEnd(event: CalendarEventTimes, timeZone: string): Date {
	if (isAllDayEvent(event)) {
		return getAllDayDateForTimezone(event.endTime, timeZone)
	} else {
		return event.endTime
	}
}

export function getEventStart({ startTime, endTime }: CalendarEventTimes, timeZone: string): Date {
	return getEventStartByTimes(startTime, endTime, timeZone)
}

export function isLongEvent(event: CalendarEvent, zone: string): boolean {
	// long events are longer than the event ID randomization range. we need to distinguish them
	// to be able to still load and display the ones overlapping the query range even though their
	// id might not be contained in the query timerange +- randomization range.
	// this also applies to events that repeat.
	return event.repeatRule != null || getEventEnd(event, zone).getTime() - getEventStart(event, zone).getTime() > DAYS_SHIFTED_MS
}

/** create an event id depending on the calendar it is in and on its length */
export function assignEventId(event: CalendarEvent, zone: string, groupRoot: CalendarGroupRoot): void {
	const listId = isLongEvent(event, zone) ? groupRoot.longEvents : groupRoot.shortEvents
	event._id = [listId, generateEventElementId(event.startTime.getTime())]
}

export function calculateAlarmTime(date: Date, interval: AlarmInterval, ianaTimeZone?: string): Date {
	const diff = alarmIntervalToLuxonDurationLikeObject(interval)

	return DateTime.fromJSDate(date, {
		zone: ianaTimeZone,
	})
		.minus(diff)
		.toJSDate()
}

export function alarmIntervalToLuxonDurationLikeObject(alarmInterval: AlarmInterval): DurationLikeObject {
	switch (alarmInterval.unit) {
		case AlarmIntervalUnit.MINUTE:
			return { minutes: alarmInterval.value }
		case AlarmIntervalUnit.HOUR:
			return { hours: alarmInterval.value }
		case AlarmIntervalUnit.DAY:
			return { days: alarmInterval.value }
		case AlarmIntervalUnit.WEEK:
			return { weeks: alarmInterval.value }
	}
}

export function findNextAlarmOccurrence(
	now: Date,
	timeZone: string,
	eventStart: Date,
	eventEnd: Date,
	frequency: RepeatPeriod,
	interval: number,
	endType: EndType,
	endValue: number,
	exclusions: Array<Date>,
	alarmTrigger: AlarmInterval,
	localTimeZone: string,
): AlarmOccurrence | null {
	let occurrenceNumber = 0
	const isAllDayEvent = isAllDayEventByTimes(eventStart, eventEnd)
	const calcEventStart = isAllDayEvent ? getAllDayDateForTimezone(eventStart, localTimeZone) : eventStart
	assertDateIsValid(calcEventStart)
	const endDate = endType === EndType.UntilDate ? (isAllDayEvent ? getAllDayDateForTimezone(new Date(endValue), localTimeZone) : new Date(endValue)) : null

	while (endType !== EndType.Count || occurrenceNumber < endValue) {
		const occurrenceDate = incrementByRepeatPeriod(calcEventStart, frequency, interval * occurrenceNumber, isAllDayEvent ? localTimeZone : timeZone)
		if (endDate && occurrenceDate.getTime() >= endDate.getTime()) {
			return null
		}

		if (!exclusions.some((d) => d.getTime() === occurrenceDate.getTime())) {
			const alarmTime = calculateAlarmTime(occurrenceDate, alarmTrigger, localTimeZone)

			if (alarmTime >= now) {
				return {
					alarmTime,
					occurrenceNumber: occurrenceNumber,
					eventTime: occurrenceDate,
				}
			}
		}
		occurrenceNumber++
	}
	return null
}

export function getEventStartByTimes(startTime: Date, endTime: Date, timeZone: string): Date {
	if (isAllDayEventByTimes(startTime, endTime)) {
		return getAllDayDateForTimezone(startTime, timeZone)
	} else {
		return startTime
	}
}

/**
 * Converts db representation of alarm to a runtime one.
 */
export function parseAlarmInterval(serialized: string): AlarmInterval {
	const matched = serialized.match(/^(\d+)([MHDW])$/)
	if (matched) {
		const [_, digits, unit] = matched
		const value = filterInt(digits)
		if (isNaN(value)) {
			throw new ParserError(`Invalid value: ${value}`)
		} else {
			return { value, unit: unit as AlarmIntervalUnit }
		}
	} else {
		throw new ParserError(`Invalid alarm interval: ${serialized}`)
	}
}
