import m from "mithril"
import { locator } from "../../common/api/main/CommonLocator.js"
import { MailFolderType } from "../../common/api/common/TutanotaConstants.js"

import { assertSystemFolderOfType } from "../../common/mailFunctionality/CommonMailUtils.js"

export async function openMailbox(userId: Id, mailAddress: string, requestedPath: string | null) {
	if (locator.logins.isUserLoggedIn() && locator.logins.getUserController().user._id === userId) {
		if (!requestedPath) {
			const [mailboxDetail] = await locator.mailModel.getMailboxDetails()
			const inbox = assertSystemFolderOfType(mailboxDetail.folders, MailFolderType.INBOX)
			m.route.set("/mail/" + inbox.mails)
		} else {
			m.route.set("/mail" + requestedPath)
		}
	} else {
		if (!requestedPath) {
			m.route.set(`/login?noAutoLogin=false&userId=${userId}&loginWith=${mailAddress}`)
		} else {
			m.route.set(`/login?noAutoLogin=false&userId=${userId}&loginWith=${mailAddress}&requestedPath=${encodeURIComponent(requestedPath)}`)
		}
	}
}
