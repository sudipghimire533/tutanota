import { CommonNativeFacade } from "../../common/native/common/generatedipc/CommonNativeFacade.js"
import { IMainLocator, locator } from "../../common/api/main/MainLocator.js"
import { TranslationKey } from "../../common/misc/LanguageViewModel.js"
import { assertNotNull, noOp, ofClass } from "@tutao/tutanota-utils"
import { CancelledError } from "../../common/api/common/error/CancelledError.js"
import { UserError } from "../../common/api/main/UserError.js"
import { themeController } from "../../common/gui/theme.js"
import m from "mithril"
import { Dialog } from "../../common/gui/base/Dialog.js"
import { FileReference } from "../../common/api/common/utils/FileUtils.js"
import { AttachmentType, getAttachmentType } from "../../common/gui/AttachmentBubble.js"
import { showRequestPasswordDialog } from "../../common/misc/passwords/PasswordRequestDialog.js"

export class MailWebCommonNativeFacade implements CommonNativeFacade {
	/**
	 * create a mail editor as requested from the native side, ie because a
	 * mailto-link was clicked or the "Send as mail" option
	 * in LibreOffice/Windows Explorer was used.
	 *
	 * if a mailtoUrl is given:
	 *  * the other arguments will be ignored.
	 *  * confidential will be set to false
	 *
	 */
	async createMailEditor(
		filesUris: ReadonlyArray<string>,
		text: string,
		addresses: ReadonlyArray<string>,
		subject: string,
		mailToUrlString: string,
	): Promise<void> {
		const { fileApp, mailModel, logins } = await MailWebCommonNativeFacade.getInitializedLocator()
		const { newMailEditorFromTemplate, newMailtoUrlMailEditor } = await import("../mail/editor/MailEditor.js")
		const signatureModule = await import("../mail/signature/Signature.js")
		await logins.waitForPartialLogin()
		const mailboxDetails = await mailModel.getUserMailboxDetails()
		let editor

		try {
			if (mailToUrlString) {
				editor = await newMailtoUrlMailEditor(mailToUrlString, false, mailboxDetails).catch(ofClass(CancelledError, noOp))
				if (!editor) return

				editor.show()
			} else {
				const files = await fileApp.getFilesMetaData(filesUris)
				const allFilesAreVCards = files.length > 0 && files.every((file) => getAttachmentType(file.mimeType) === AttachmentType.CONTACT)

				let willImport = false
				if (allFilesAreVCards) {
					willImport = await Dialog.choice("vcardInSharingFiles_msg", [
						{
							text: "import_action",
							value: true,
						},
						{ text: "attachFiles_action", value: false },
					])
				}

				if (willImport) {
					await this.handleFileImport(filesUris)
				} else {
					const address = (addresses && addresses[0]) || ""
					const recipients = address
						? {
								to: [
									{
										name: "",
										address: address,
									},
								],
						  }
						: {}
					editor = await newMailEditorFromTemplate(
						mailboxDetails,
						recipients,
						subject || (files.length > 0 ? files[0].name : ""),
						signatureModule.appendEmailSignature(text || "", logins.getUserController().props),
						files,
						undefined,
						undefined,
						true, // we want emails created in this method to always default to saving changes
					)

					editor.show()
				}
			}
		} catch (e) {
			if (e instanceof UserError) {
				// noinspection ES6MissingAwait
				Dialog.message(() => e.message)
			}
			throw e
		}
	}

	async invalidateAlarms(): Promise<void> {
		const locator = await MailWebCommonNativeFacade.getInitializedLocator()
		await locator.pushService.reRegister()
	}

	async openCalendar(userId: string): Promise<void> {
		const { openCalendar } = await import("../../common/native/main/OpenCalendarHandler.js")
		return openCalendar(userId)
	}

	async openMailBox(userId: string, address: string, requestedPath: string | null): Promise<void> {
		const { openMailbox } = await import("./OpenMailboxHandler.js")
		return openMailbox(userId, address, requestedPath)
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
			import("../settings/PasswordForm.js"),
		])
		const locator = await MailWebCommonNativeFacade.getInitializedLocator()
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
		const { locator } = await import("../../common/api/main/MainLocator.js")
		await locator.initialized
		return locator
	}

	private async parseContacts(fileList: FileReference[]) {
		const { fileApp, logins } = await MailWebCommonNativeFacade.getInitializedLocator()

		await logins.waitForPartialLogin()

		const rawContacts: string[] = []
		for (const file of fileList) {
			if (getAttachmentType(file.mimeType) === AttachmentType.CONTACT) {
				const dataFile = await fileApp.readDataFile(file.location)
				if (dataFile == null) continue

				const decoder = new TextDecoder("utf-8")
				const vCardData = decoder.decode(dataFile.data)

				rawContacts.push(vCardData)
			}
		}

		return rawContacts
	}

	/**
	 * Parse and handle files given a list of files URI. For now, it just supports .vcf files
	 * @param filesUris List of files URI to be parsed
	 */
	async handleFileImport(filesUris: ReadonlyArray<string>): Promise<void> {
		// FIXME: contactImporter is no longer in locator, may need to split CommonNativeFacade into
		// mail and calendar
		const { fileApp, contactModel } = await MailWebCommonNativeFacade.getInitializedLocator()
		// FIXME: const importer = await contactImporter()

		// For now, we just handle .vcf files, so we don't need to care about the file type
		const files = await fileApp.getFilesMetaData(filesUris)
		const contacts = await this.parseContacts(files)
		const vCardData = contacts.join("\n")
		const contactListId = assertNotNull(await contactModel.getContactListId())

		// FIXME: await importer.importContactsFromFile(vCardData, contactListId)
	}
}
