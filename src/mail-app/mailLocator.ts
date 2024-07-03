import { assertMainOrNode, isApp, isBrowser, isDesktop } from "../common/api/common/Env.js"
import { MinimizedMailEditorViewModel } from "./mail/model/MinimizedMailEditorViewModel"
// we want to move MailAddressNameChanger, MailAddressTableModel but need to make settings descisions
import type { CreateMailViewerOptions } from "./mail/view/MailViewer.js"
import type { MailViewerViewModel } from "./mail/view/MailViewerViewModel.js"
import type { ExternalLoginViewModel } from "../common/login/ExternalLoginView.js"
import type { ConversationViewModel, ConversationViewModelFactory } from "./mail/view/ConversationViewModel.js"
import { NativeContactsSyncManager } from "./contacts/model/NativeContactsSyncManager.js"
import { MailOpenedListener } from "./mail/view/MailViewModel.js"
import { InboxRuleHandler } from "./mail/model/InboxRuleHandler.js"
import { Mail } from "../common/api/entities/tutanota/TypeRefs.js"
import { getDisplayedSender } from "../common/mailFunctionality/CommonMailUtils.js"
import { ContactImporter } from "./contacts/ContactImporter.js"
import { AddNotificationEmailDialog } from "./settings/AddNotificationEmailDialog.js"
import { assert, lazyAsync, lazyMemoized, noOp } from "@tutao/tutanota-utils"
import { deviceConfig } from "../common/misc/DeviceConfig.js"
import { locator } from "../common/api/main/MainLocator.js"
import { ScopedRouter } from "../common/gui/ScopedRouter.js"
import type { CredentialRemovalHandler } from "../common/login/CredentialRemovalHandler.js"
import { GroupType } from "../common/api/common/TutanotaConstants.js"

assertMainOrNode()

class MailLocator {
	minimizedMailModel!: MinimizedMailEditorViewModel

	async createInstances() {
		this.minimizedMailModel = new MinimizedMailEditorViewModel()
	}

	async init(): Promise<void> {
		await this.createInstances()

		//this.deferredInitialized.resolve()
	}

	readonly conversationViewModelFactory: lazyAsync<ConversationViewModelFactory> = async () => {
		const { ConversationViewModel } = await import("./mail/view/ConversationViewModel.js")
		const factory = await this.mailViewerViewModelFactory()
		const m = await import("mithril")
		return (options: CreateMailViewerOptions) => {
			return new ConversationViewModel(
				options,
				(options) => factory(options),
				locator.entityClient,
				locator.eventController,
				deviceConfig,
				locator.mailModel,
				m.redraw,
			)
		}
	}

	async conversationViewModel(options: CreateMailViewerOptions): Promise<ConversationViewModel> {
		const factory = await this.conversationViewModelFactory()
		return factory(options)
	}

	contactImporter = async (): Promise<ContactImporter> => {
		const { ContactImporter } = await import("./contacts/ContactImporter.js")
		return new ContactImporter(locator.contactFacade, locator.systemPermissionHandler)
	}

	async mailViewerViewModelFactory(): Promise<(options: CreateMailViewerOptions) => MailViewerViewModel> {
		const { MailViewerViewModel } = await import("./mail/view/MailViewerViewModel.js")
		return ({ mail, showFolder }) =>
			new MailViewerViewModel(
				mail,
				showFolder,
				locator.entityClient,
				locator.mailModel,
				locator.contactModel,
				locator.configFacade,
				locator.fileController,
				locator.logins,
				async (mailboxDetails) => {
					const mailboxProperties = await locator.mailModel.getMailboxProperties(mailboxDetails.mailboxGroupRoot)
					return locator.sendMailModel(mailboxDetails, mailboxProperties)
				},
				locator.eventController,
				locator.workerFacade,
				locator.search,
				locator.mailFacade,
				locator.cryptoFacade,
				() => this.contactImporter(),
			)
	}

	async externalLoginViewModelFactory(): Promise<() => ExternalLoginViewModel> {
		const { ExternalLoginViewModel } = await import("../common/login/ExternalLoginView.js")
		return () => new ExternalLoginViewModel(locator.credentialsProvider)
	}

	readonly mailViewModel = lazyMemoized(async () => {
		const { MailViewModel } = await import("./mail/view/MailViewModel.js")
		const conversationViewModelFactory = await this.conversationViewModelFactory()
		const router = new ScopedRouter(locator.throttledRouter(), "/mail")
		return new MailViewModel(
			locator.mailModel,
			locator.entityClient,
			locator.eventController,
			locator.connectivityModel,
			locator.cacheStorage,
			conversationViewModelFactory,
			this.mailOpenedListener,
			deviceConfig,
			this.inboxRuleHanlder(),
			router,
			await locator.redraw(),
		)
	})

	readonly nativeContactsSyncManager = lazyMemoized(() => {
		assert(isApp(), "isApp")
		return new NativeContactsSyncManager(
			locator.logins,
			locator.mobileContactsFacade,
			locator.entityClient,
			locator.eventController,
			locator.contactModel,
			deviceConfig,
		)
	})

	async credentialsRemovalHandler(): Promise<CredentialRemovalHandler> {
		const { NoopCredentialRemovalHandler, AppsCredentialRemovalHandler } = await import("../common/login/CredentialRemovalHandler.js")
		return isBrowser()
			? new NoopCredentialRemovalHandler()
			: new AppsCredentialRemovalHandler(
					locator.indexerFacade,
					locator.pushService,
					locator.configFacade,
					isApp() ? this.nativeContactsSyncManager() : null,
			  )
	}

	readonly mailOpenedListener: MailOpenedListener = {
		onEmailOpened: isDesktop()
			? (mail: Mail) => {
					locator.desktopSystemFacade.sendSocketMessage(getDisplayedSender(mail).address)
			  }
			: noOp,
	}

	inboxRuleHanlder(): InboxRuleHandler {
		return new InboxRuleHandler(locator.mailFacade, locator.entityClient, locator.logins)
	}

	async addNotificationEmailDialog(): Promise<AddNotificationEmailDialog> {
		const { AddNotificationEmailDialog } = await import("./settings/AddNotificationEmailDialog.js")
		return new AddNotificationEmailDialog(locator.logins, locator.entityClient)
	}

	readonly contactViewModel = lazyMemoized(async () => {
		const { ContactViewModel } = await import("./contacts/view/ContactViewModel.js")
		const router = new ScopedRouter(locator.throttledRouter(), "/contact")
		return new ContactViewModel(locator.contactModel, locator.entityClient, locator.eventController, router, await locator.redraw())
	})

	readonly contactListViewModel = lazyMemoized(async () => {
		const { ContactListViewModel } = await import("./contacts/view/ContactListViewModel.js")
		const router = new ScopedRouter(locator.throttledRouter(), "/contactlist")
		return new ContactListViewModel(
			locator.entityClient,
			locator.groupManagementFacade,
			locator.logins,
			locator.eventController,
			locator.contactModel,
			await locator.receivedGroupInvitationsModel(GroupType.ContactList),
			router,
			await locator.redraw(),
		)
	})
}

export type IMailLocator = Readonly<MailLocator>

export const mailLocator: IMailLocator = new MailLocator()
