import type { CredentialRemovalHandler } from "../common/login/CredentialRemovalHandler.js"
import { isBrowser } from "../common/api/common/Env.js"
import { locator } from "../common/api/main/MainLocator.js"

class CalendarLocator {
	async credentialsRemovalHandler(): Promise<CredentialRemovalHandler> {
		const { NoopCredentialRemovalHandler, AppsCredentialRemovalHandler } = await import("../common/login/CredentialRemovalHandler.js")
		return isBrowser()
			? new NoopCredentialRemovalHandler()
			: new AppsCredentialRemovalHandler(locator.indexerFacade, locator.pushService, locator.configFacade, null)
	}

	async init(): Promise<void> {
		// await this.createInstances()
		console.log("initializing calendarLocator")
		//this.deferredInitialized.resolve()
	}
}

export type ICalendarLocator = Readonly<CalendarLocator>

export const calendarLocator: ICalendarLocator = new CalendarLocator()
