import m from "mithril"
import { CommonNativeFacade } from "../../common/native/common/generatedipc/CommonNativeFacade.js"
import { TranslationKey } from "../../common/misc/LanguageViewModel.js"
import { themeController } from "../../common/gui/theme.js"
import { CancelledError } from "../../common/api/common/error/CancelledError.js"
import { showRequestPasswordDialog } from "../../common/misc/passwords/PasswordRequestDialog.js"
import { IMainLocator } from "../../common/api/main/CommonLocator.js"
import { Dialog } from "../../common/gui/base/Dialog.js"

export class CalendarWebCommonNativeFacade implements CommonNativeFacade {
	async createMailEditor(
		filesUris: ReadonlyArray<string>,
		text: string,
		addresses: ReadonlyArray<string>,
		subject: string,
		mailToUrlString: string,
	): Promise<void> {
		// not implemented but keeping stub for completeness
	}

	async invalidateAlarms(): Promise<void> {
		const locator = await CalendarWebCommonNativeFacade.getInitializedLocator()
		await locator.pushService.reRegister()
	}

	async openCalendar(userId: string): Promise<void> {
		const { openCalendar } = await import("../../common/native/main/OpenCalendarHandler.js")
		return openCalendar(userId)
	}

	async openMailBox(userId: string, address: string, requestedPath: string | null): Promise<void> {
		// not implemented but keeping stub for completeness
	}

	async showAlertDialog(translationKey: string): Promise<void> {
		const { Dialog } = await import("../../common/gui/base/Dialog.js")
		return Dialog.message(translationKey as TranslationKey)
	}

	async updateTheme(): Promise<void> {
		await themeController.reloadTheme()
	}

	/**
	 * largely modeled after ChangePasswordOkAction, except that we're never changing the password with it and
	 * don't support bcrypt for this one.
	 */
	async promptForNewPassword(title: string, oldPassword: string | null): Promise<string> {
		const [{ Dialog }, { PasswordForm, PasswordModel }] = await Promise.all([
			import("../../common/gui/base/Dialog.js"),
			import("../../mail-app/settings/PasswordForm.js"),
		])
		const locator = await CalendarWebCommonNativeFacade.getInitializedLocator()
		const model = new PasswordModel(locator.usageTestController, locator.logins, { checkOldPassword: false, enforceStrength: false })

		return new Promise((resolve, reject) => {
			const changePasswordOkAction = async (dialog: Dialog) => {
				const error = model.getErrorMessageId()

				if (error) {
					Dialog.message(error)
				} else {
					resolve(model.getNewPassword())
					dialog.close()
				}
			}

			Dialog.showActionDialog({
				title: () => title,
				child: () => m(PasswordForm, { model }),
				validator: () => model.getErrorMessageId(),
				okAction: changePasswordOkAction,
				cancelAction: () => reject(new CancelledError("user cancelled operation")),
				allowCancel: true,
			})
		})
	}

	async promptForPassword(title: string): Promise<string> {
		const { Dialog } = await import("../../common/gui/base/Dialog.js")

		return new Promise((resolve, reject) => {
			const dialog = showRequestPasswordDialog({
				title,
				action: async (pw) => {
					resolve(pw)
					dialog.close()
					return ""
				},
				cancel: {
					textId: "cancel_action",
					action: () => reject(new CancelledError("user cancelled operation")),
				},
			})
		})
	}

	private static async getInitializedLocator(): Promise<IMainLocator> {
		const { locator } = await import("../../common/api/main/CommonLocator")
		await locator.initialized
		return locator
	}

	/**
	 * Parse and handle files given a list of files URI. For now, it is empty (see MailWebCommonNativeFacade for original copy)
	 * @param filesUris List of files URI to be parsed
	 */
	async handleFileImport(filesUris: ReadonlyArray<string>): Promise<void> {
		// Later this is where we should handle ics file imports
		console.log("not implemented")
	}
}
