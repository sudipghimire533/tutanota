import { locator } from "../../api/main/MainLocator.js"
import m from "mithril"

export function openCalendar(userId: Id) {
	if (locator.logins.isUserLoggedIn() && locator.logins.getUserController().user._id === userId) {
		m.route.set("/calendar/agenda")
	} else {
		m.route.set(`/login?noAutoLogin=false&userId=${userId}&requestedPath=${encodeURIComponent("/calendar/agenda")}`)
	}
}
